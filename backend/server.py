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
    # also delete children
    await db.maps.delete_many({"parent_map_id": map_id})
    await db.maps.delete_one({"id": map_id})
    return {"ok": True}


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
