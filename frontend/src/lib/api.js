import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const Campaigns = {
  list: () => api.get("/campaigns").then((r) => r.data),
  get: (id) => api.get(`/campaigns/${id}`).then((r) => r.data),
  create: (data) => api.post("/campaigns", data).then((r) => r.data),
  update: (id, data) => api.patch(`/campaigns/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/campaigns/${id}`).then((r) => r.data),
  rootMap: (id) => api.get(`/campaigns/${id}/root_map`).then((r) => r.data),
  maps: (id) => api.get(`/campaigns/${id}/maps`).then((r) => r.data),
};

export const Maps = {
  get: (id) => api.get(`/maps/${id}`).then((r) => r.data),
  create: (data) => api.post("/maps", data).then((r) => r.data),
  update: (id, data) => api.patch(`/maps/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/maps/${id}`).then((r) => r.data),
};

export const AI = {
  redraw: (payload) =>
    api.post("/ai/redraw", payload, { timeout: 120000 }).then((r) => r.data),
};
