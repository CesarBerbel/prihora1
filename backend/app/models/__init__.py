"""Modelos do dominio. Importar daqui garante que o metadata esteja completo."""

from app.models.booking import AuditLog, Booking, Review, Subscription
from app.models.catalog import Category, City, Plan, professional_categories
from app.models.client import ProfessionalClient, phone_digits
from app.models.finance import Expense
from app.models.message import Message, WhatsappSession
from app.models.notification import NotificationRule
from app.models.package import PackageItem, PackageSale, ServicePackage
from app.models.enums import (
    BillingInterval,
    BookingStatus,
    MessageChannel,
    MessageStatus,
    NotificationAudience,
    NotificationTrigger,
    PackageKind,
    PackageSaleStatus,
    ProfessionalStatus,
    SubscriptionStatus,
    UserRole,
)
from app.models.professional import Availability, Professional, Service, TimeOff
from app.models.user import User

__all__ = [
    "AuditLog", "Availability", "BillingInterval", "Booking", "BookingStatus",
    "Category", "City", "Expense", "Message", "MessageChannel", "MessageStatus",
    "Plan", "Professional", "ProfessionalClient",
    "ProfessionalStatus", "Review",
    "Service", "Subscription", "SubscriptionStatus", "TimeOff", "User", "UserRole",
    "NotificationAudience", "NotificationRule",
    "NotificationTrigger", "WhatsappSession",
    "PackageItem", "PackageKind", "PackageSale", "PackageSaleStatus", "ServicePackage",
    "phone_digits",
    "professional_categories",
]
