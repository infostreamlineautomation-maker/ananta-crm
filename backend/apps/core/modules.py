"""Registry of permission-checked modules, shared by the RBAC system and every app's API views.

Adding a new module means adding one entry here — RolePermission rows for every
existing role are then backfilled automatically (see accounts.permissions.sync_role_permissions).
"""

CLIENTS = "clients"
COMPANIES = "companies"
CATALOG = "catalog"
SUPPLIERS = "suppliers"
PROJECTS = "projects"
ORDERS = "orders"
QUOTATIONS = "quotations"
COSTING = "costing"
REPORTS = "reports"
USERS = "users"
SETTINGS = "settings"
NOTIFICATIONS = "notifications"

MODULES = {
    CLIENTS: "Clients",
    COMPANIES: "Companies",
    CATALOG: "Products",
    SUPPLIERS: "Suppliers",
    PROJECTS: "Projects",
    ORDERS: "Orders",
    QUOTATIONS: "Quotations",
    COSTING: "Costing",
    REPORTS: "Reports",
    USERS: "Users",
    SETTINGS: "Settings",
    NOTIFICATIONS: "Notifications",
}

MODULE_CHOICES = list(MODULES.items())

VIEW = "view"
ADD = "add"
EDIT = "edit"
DELETE = "delete"
ACTIONS = (VIEW, ADD, EDIT, DELETE)

# Maps HTTP methods to the action they require, for the DRF permission class.
METHOD_ACTION_MAP = {
    "GET": VIEW,
    "HEAD": VIEW,
    "OPTIONS": VIEW,
    "POST": ADD,
    "PUT": EDIT,
    "PATCH": EDIT,
    "DELETE": DELETE,
}
