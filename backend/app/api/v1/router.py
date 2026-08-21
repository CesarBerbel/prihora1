from fastapi import APIRouter

from app.api.v1 import admin, auth, messages, notifications, professional, public

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(public.router)
api_router.include_router(professional.router)
api_router.include_router(messages.router)
api_router.include_router(notifications.router)
api_router.include_router(admin.router)
