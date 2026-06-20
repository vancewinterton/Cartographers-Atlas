import os
import uuid
import base64
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Cartographer's Atlas API")
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Campaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    cover_image: Optional[str] = None  # base64 data URL or remote URL
    share_token: Optional[str] = None  # set when sharing is enabled
    hp_bars_public: bool = True  # when False, HP bars hidden from share viewers
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class CampaignCreate(BaseModel):
    name: str
    description: str = ""
    cover_image: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    hp_bars_public: Optional[bool] = None


class MapDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    campaign_id: str
    parent_map_id: Optional[str] = None  # for nested maps (dungeon under world map)
    parent_pin_id: Optional[str] = None  # which pin opens this map
    name: str
    image_data: Optional[str] = None  # base64 data URL of the imported map image
    image_width: int = 1600
    image_height: int = 1000
    layers: List[Dict[str, Any]] = Field(default_factory=list)  # drawing layers
    pins: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class MapCreate(BaseModel):
    campaign_id: str
    name: str
    parent_map_id: Optional[str] = None
    parent_pin_id: Optional[str] = None
    image_data: Optional[str] = None
    image_width: int = 1600
    image_height: int = 1000


class MapUpdate(BaseModel):
    name: Optional[str] = None
    image_data: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    layers: Optional[List[Dict[str, Any]]] = None
    pins: Optional[List[Dict[str, Any]]] = None


class AIRedrawRequest(BaseModel):
    prompt: str
    model: str = "gemini"  # 'gemini' or 'openai'
    image_base64: Optional[str] = None  # cropped region (for gemini editing)
    width: int = 1024
    height: int = 1024


class AIRedrawResponse(BaseModel):
    image_base64: str


class CampaignExport(BaseModel):
    format_version: int = 1
    exported_at: str = Field(default_factory=now_iso)
    campaign: Dict[str, Any]
    maps: List[Dict[str, Any]]


class CampaignImportRequest(BaseModel):
    data: Dict[str, Any]
    rename: Optional[str] = None  # optionally rename on import


class Preset(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    cover_image: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)  # full campaign export bundle
    created_at: str = Field(default_factory=now_iso)


class PresetMeta(BaseModel):
    id: str
    name: str
    description: str = ""
    cover_image: Optional[str] = None
    created_at: str


# ---------- Helpers ----------
def strip_data_url(b64: str) -> str:
    if b64.startswith("data:") and "," in b64:
        return b64.split(",", 1)[1]
    return b64


# ---------- Campaign Routes ----------
@api_router.get("/campaigns", response_model=List[Campaign])
async def list_campaigns():
    docs = await db.campaigns.find({}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return [Campaign(**d) for d in docs]


@api_router.post("/campaigns", response_model=Campaign)
async def create_campaign(payload: CampaignCreate):
    camp = Campaign(**payload.model_dump())
    await db.campaigns.insert_one(camp.model_dump())
    # auto-create a root world map for this campaign
    root_map = MapDoc(
        campaign_id=camp.id,
        name="World Map",
        image_data=payload.cover_image,
    )
    await db.maps.insert_one(root_map.model_dump())
    return camp


@api_router.get("/campaigns/{campaign_id}", response_model=Campaign)
async def get_campaign(campaign_id: str):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Campaign not found")
    return Campaign(**doc)


@api_router.patch("/campaigns/{campaign_id}", response_model=Campaign)
async def update_campaign(campaign_id: str, payload: CampaignUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    res = await db.campaigns.find_one_and_update(
        {"id": campaign_id}, {"$set": update}, return_document=True
    )
    if not res:
        raise HTTPException(404, "Campaign not found")
    res.pop("_id", None)
    return Campaign(**res)


@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str):
    await db.campaigns.delete_one({"id": campaign_id})
    await db.maps.delete_many({"campaign_id": campaign_id})
    return {"ok": True}


@api_router.post("/campaigns/{campaign_id}/share")
async def enable_share(campaign_id: str):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Campaign not found")
    token = doc.get("share_token") or uuid.uuid4().hex
    await db.campaigns.update_one(
        {"id": campaign_id}, {"$set": {"share_token": token, "updated_at": now_iso()}}
    )
    return {"share_token": token}


@api_router.delete("/campaigns/{campaign_id}/share")
async def disable_share(campaign_id: str):
    await db.campaigns.update_one(
        {"id": campaign_id}, {"$set": {"share_token": None, "updated_at": now_iso()}}
    )
    return {"ok": True}


@api_router.get("/share/{share_token}")
async def get_shared_campaign(share_token: str):
    """Public read-only endpoint — returns the campaign + all of its maps."""
    doc = await db.campaigns.find_one({"share_token": share_token}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Shared campaign not found or sharing disabled")
    maps = await db.maps.find({"campaign_id": doc["id"]}, {"_id": 0}).to_list(500)
    return {"campaign": Campaign(**doc), "maps": [MapDoc(**m) for m in maps]}


@api_router.get("/campaigns/{campaign_id}/export", response_model=CampaignExport)
async def export_campaign(campaign_id: str):
    """Bundle a campaign + all of its maps (images, pins, shapes, sub-maps) into a
    single JSON blob the user can download and hand off to another DM."""
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campaign not found")
    maps = await db.maps.find({"campaign_id": campaign_id}, {"_id": 0}).to_list(500)
    # strip share token from the export — the importer should generate their own
    camp_clean = {**camp, "share_token": None}
    return CampaignExport(campaign=camp_clean, maps=maps)


async def _clone_export_into_campaign(data: Dict[str, Any], rename: Optional[str] = None) -> Campaign:
    """Clone an exported campaign bundle into a brand-new campaign with fresh IDs.
    Shared by the import endpoint and the preset 'use template' endpoint."""
    data = data or {}
    src_campaign = data.get("campaign")
    src_maps = data.get("maps") or []
    if not src_campaign or not isinstance(src_maps, list):
        raise HTTPException(400, "Invalid campaign export file")

    new_campaign_id = str(uuid.uuid4())
    id_map = {m.get("id"): str(uuid.uuid4()) for m in src_maps if m.get("id")}

    new_campaign = Campaign(
        id=new_campaign_id,
        name=(rename or src_campaign.get("name", "Imported Campaign")).strip()
        or "Imported Campaign",
        description=src_campaign.get("description", ""),
        cover_image=src_campaign.get("cover_image"),
        share_token=None,
    )
    await db.campaigns.insert_one(new_campaign.model_dump())

    new_maps: List[Dict[str, Any]] = []
    for m in src_maps:
        old_id = m.get("id")
        new_id = id_map.get(old_id, str(uuid.uuid4()))
        parent_old = m.get("parent_map_id")
        parent_new = id_map.get(parent_old) if parent_old else None
        pins = []
        for p in m.get("pins") or []:
            p2 = {**p}
            if p2.get("linked_map_id") in id_map:
                p2["linked_map_id"] = id_map[p2["linked_map_id"]]
            pins.append(p2)
        new_map = MapDoc(
            id=new_id,
            campaign_id=new_campaign_id,
            parent_map_id=parent_new,
            parent_pin_id=m.get("parent_pin_id"),
            name=m.get("name") or "Map",
            image_data=m.get("image_data"),
            image_width=m.get("image_width") or 1600,
            image_height=m.get("image_height") or 1000,
            layers=m.get("layers") or [],
            pins=pins,
        )
        new_maps.append(new_map.model_dump())
    if new_maps:
        await db.maps.insert_many(new_maps)

    if not any(m.get("parent_map_id") is None for m in new_maps):
        root = MapDoc(campaign_id=new_campaign_id, name="World Map")
        await db.maps.insert_one(root.model_dump())

    return new_campaign


@api_router.post("/campaigns/import", response_model=Campaign)
async def import_campaign(payload: CampaignImportRequest):
    """Import a previously-exported campaign JSON. Generates fresh IDs for the
    campaign and every map, remaps parent_map_id / linked_map_id so the nested
    structure stays intact."""
    return await _clone_export_into_campaign(payload.data, payload.rename)


# ---------- Preset / Template Routes ----------
@api_router.get("/presets", response_model=List[PresetMeta])
async def list_presets():
    docs = await db.presets.find({}, {"_id": 0, "data": 0}).sort("created_at", 1).to_list(200)
    return [PresetMeta(**d) for d in docs]


@api_router.post("/presets/{preset_id}/use", response_model=Campaign)
async def use_preset(preset_id: str):
    preset = await db.presets.find_one({"id": preset_id}, {"_id": 0})
    if not preset:
        raise HTTPException(404, "Preset not found")
    return await _clone_export_into_campaign(preset.get("data") or {}, None)


@api_router.post("/campaigns/{campaign_id}/save-as-preset", response_model=PresetMeta)
async def save_campaign_as_preset(campaign_id: str):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campaign not found")
    maps = await db.maps.find({"campaign_id": campaign_id}, {"_id": 0}).to_list(500)
    camp_clean = {**camp, "share_token": None}
    bundle = CampaignExport(campaign=camp_clean, maps=maps).model_dump()
    preset = Preset(
        name=camp.get("name", "Untitled Campaign"),
        description=camp.get("description", ""),
        cover_image=camp.get("cover_image"),
        data=bundle,
    )
    await db.presets.insert_one(preset.model_dump())
    return PresetMeta(**preset.model_dump())


@api_router.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str):
    await db.presets.delete_one({"id": preset_id})
    return {"ok": True}


# ---------- Map Routes ----------
@api_router.get("/campaigns/{campaign_id}/maps", response_model=List[MapDoc])
async def list_maps(campaign_id: str):
    docs = await db.maps.find({"campaign_id": campaign_id}, {"_id": 0}).to_list(500)
    return [MapDoc(**d) for d in docs]


@api_router.get("/campaigns/{campaign_id}/root_map", response_model=MapDoc)
async def get_root_map(campaign_id: str):
    doc = await db.maps.find_one(
        {"campaign_id": campaign_id, "parent_map_id": None}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Root map not found")
    return MapDoc(**doc)


@api_router.get("/maps/{map_id}", response_model=MapDoc)
async def get_map(map_id: str):
    doc = await db.maps.find_one({"id": map_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Map not found")
    return MapDoc(**doc)


@api_router.post("/maps", response_model=MapDoc)
async def create_map(payload: MapCreate):
    m = MapDoc(**payload.model_dump())
    await db.maps.insert_one(m.model_dump())
    return m


@api_router.patch("/maps/{map_id}", response_model=MapDoc)
async def update_map(map_id: str, payload: MapUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    res = await db.maps.find_one_and_update(
        {"id": map_id}, {"$set": update}, return_document=True
    )
    if not res:
        raise HTTPException(404, "Map not found")
    res.pop("_id", None)
    return MapDoc(**res)


@api_router.delete("/maps/{map_id}")
async def delete_map(map_id: str):
    # Recursive cascade: delete all descendants regardless of depth
    to_delete = [map_id]
    frontier = [map_id]
    while frontier:
        kids = await db.maps.find(
            {"parent_map_id": {"$in": frontier}}, {"_id": 0, "id": 1}
        ).to_list(1000)
        kid_ids = [k["id"] for k in kids]
        if not kid_ids:
            break
        to_delete.extend(kid_ids)
        frontier = kid_ids
    await db.maps.delete_many({"id": {"$in": to_delete}})
    return {"ok": True, "deleted": len(to_delete)}


# ---------- AI Routes ----------
@api_router.post("/ai/redraw", response_model=AIRedrawResponse)
async def ai_redraw(req: AIRedrawRequest):
    """Redraw / generate an image region using either Gemini Nano Banana (image edit)
    or OpenAI gpt-image-1 (text-to-image)."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    try:
        if req.model == "gemini":
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

            chat = LlmChat(
                api_key=api_key,
                session_id=f"redraw-{uuid.uuid4()}",
                system_message=(
                    "You are an expert fantasy cartographer. You redraw regions of "
                    "tabletop RPG maps based on text descriptions, matching the "
                    "existing map's style."
                ),
            )
            chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
                modalities=["image", "text"]
            )

            file_contents = []
            if req.image_base64:
                file_contents.append(ImageContent(strip_data_url(req.image_base64)))

            msg = UserMessage(
                text=(
                    f"Redraw this map region in a top-down fantasy cartography style. "
                    f"Description: {req.prompt}. Keep edges consistent with surrounding "
                    f"terrain. Output a square image."
                ),
                file_contents=file_contents if file_contents else None,
            )
            _, images = await chat.send_message_multimodal_response(msg)
            if not images:
                raise HTTPException(500, "Gemini returned no image")
            return AIRedrawResponse(image_base64=images[0]["data"])

        elif req.model == "openai":
            from emergentintegrations.llm.openai.image_generation import (
                OpenAIImageGeneration,
            )

            image_gen = OpenAIImageGeneration(api_key=api_key)
            prompt = (
                f"Top-down fantasy tabletop RPG map region in hand-drawn cartographer "
                f"style with parchment tones. {req.prompt}. Highly detailed, no text labels."
            )
            images = await image_gen.generate_images(
                prompt=prompt, model="gpt-image-1", number_of_images=1
            )
            if not images:
                raise HTTPException(500, "OpenAI returned no image")
            b64 = base64.b64encode(images[0]).decode("utf-8")
            return AIRedrawResponse(image_base64=b64)

        else:
            raise HTTPException(400, f"Unknown model: {req.model}")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI redraw failed")
        raise HTTPException(500, f"AI generation failed: {str(e)[:200]}")


@api_router.get("/")
async def root():
    return {"message": "Cartographer's Atlas API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def seed_presets():
    """Seed a starter template campaign the first time the app boots so the
    Templates gallery isn't empty. DMs add their own via 'Save as Template'."""
    try:
        existing = await db.presets.count_documents({})
        if existing:
            return
        root_id = str(uuid.uuid4())
        dungeon_id = str(uuid.uuid4())
        dungeon_pin_id = str(uuid.uuid4())
        bundle = {
            "format_version": 1,
            "campaign": {
                "name": "Starter — The Borderlands",
                "description": "A ready-to-run starter world with a town, a road, and a linked dungeon. Open it and make it yours.",
                "cover_image": None,
            },
            "maps": [
                {
                    "id": root_id,
                    "parent_map_id": None,
                    "name": "World Map",
                    "image_data": None,
                    "image_width": 1600,
                    "image_height": 1000,
                    "layers": [
                        {
                            "id": "L1",
                            "name": "Layer 1",
                            "visible": True,
                            "locked": False,
                            "shapes": [
                                {"id": str(uuid.uuid4()), "type": "text", "layerId": "L1",
                                 "x": 360, "y": 240, "size": 40, "color": "#D97706", "text": "Oakhaven"},
                                {"id": str(uuid.uuid4()), "type": "text", "layerId": "L1",
                                 "x": 980, "y": 620, "size": 36, "color": "#D97706", "text": "The Deep Barrow"},
                            ],
                        }
                    ],
                    "pins": [
                        {"id": str(uuid.uuid4()), "x": 420, "y": 320, "label": "Oakhaven",
                         "description": "A small frontier town. Start here.", "color": "#D97706",
                         "icon": "town", "linked_map_id": None},
                        {"id": dungeon_pin_id, "x": 1040, "y": 700, "label": "The Deep Barrow",
                         "description": "An ancient dungeon. Click to descend.", "color": "#A855F7",
                         "icon": "dungeon", "linked_map_id": dungeon_id},
                    ],
                },
                {
                    "id": dungeon_id,
                    "parent_map_id": root_id,
                    "parent_pin_id": dungeon_pin_id,
                    "name": "The Deep Barrow",
                    "image_data": None,
                    "image_width": 1600,
                    "image_height": 1000,
                    "layers": [
                        {
                            "id": "L1",
                            "name": "Layer 1",
                            "visible": True,
                            "locked": False,
                            "shapes": [
                                {"id": str(uuid.uuid4()), "type": "text", "layerId": "L1",
                                 "x": 600, "y": 120, "size": 36, "color": "#A855F7", "text": "Entrance Hall"},
                            ],
                        }
                    ],
                    "pins": [],
                },
            ],
        }
        preset = Preset(
            name="Starter — The Borderlands",
            description="A ready-to-run starter world with a town and a linked dungeon.",
            cover_image=None,
            data=bundle,
        )
        await db.presets.insert_one(preset.model_dump())
        logger.info("Seeded starter preset campaign")
    except Exception as e:
        logger.warning(f"Preset seed skipped: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
