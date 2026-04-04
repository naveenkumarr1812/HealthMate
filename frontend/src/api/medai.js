import axios from "axios";

const API = axios.create({ baseURL: "/api" });

// Inject token from localStorage into every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// AUTH
export const loginUser = (email, password) =>
  API.post("/auth/login", { email, password });

export const signupUser = (email, password, full_name) =>
  API.post("/auth/signup", { email, password, full_name });

export const getProfile = (user_id) =>
  API.get(`/auth/profile/${user_id}`);

export const updateProfile = (user_id, conditions, allergies) =>
  API.put("/auth/profile", { user_id, conditions, allergies });

// CHAT
export const sendChat = (user_id, query, mode = "chat", symptom_data = {}, symptom_step = 0) =>
  API.post("/chat", { user_id, query, mode, symptom_data, symptom_step });

export const getChatHistory = (user_id) =>
  API.get(`/chat/history/${user_id}`);

// DOCUMENTS
export const uploadDocument = (user_id, file) => {
  const formData = new FormData();
  formData.append("user_id", user_id);
  formData.append("file", file);
  return API.post("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const listDocuments = (user_id) =>
  API.get(`/documents/list/${user_id}`);

export const summarizeText = (user_id, document_text) =>
  API.post("/documents/summarize", { user_id, document_text });

// SYMPTOMS
export const checkSymptom = (user_id, message, step, collected_data) =>
  API.post("/symptoms/check", { user_id, message, step, collected_data });

// NEWS
export const getMedicalNews = () => API.get("/news/medical");
export const getPersonalizedNews = (user_id) =>
  API.get(`/news/personalized/${user_id}`);
