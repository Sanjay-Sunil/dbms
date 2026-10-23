from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('auth/login/', TokenObtainPairView.as_view(), name='token-obtain'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/', include('accounts.urls')),

    # Food Points & Ingredients
    path('food-points/', views.FoodPointListView.as_view(), name='food-point-list'),
    path('food-points/<int:pk>/', views.FoodPointDetailView.as_view(), name='food-point-detail'),
    path('ingredients/', views.IngredientListView.as_view(), name='ingredient-list'),

    # Menu
    path('menu/', views.MenuItemListView.as_view(), name='menu-list'),
    path('menu/<int:pk>/', views.MenuItemDetailView.as_view(), name='menu-detail'),
    path('menu/manage/', views.MenuItemAdminView.as_view(), name='menu-manage'),
    path('menu/manage/<int:pk>/', views.MenuItemAdminDetailView.as_view(), name='menu-manage-detail'),

    # Inventory
    path('inventory/', views.InventoryStockListView.as_view(), name='inventory-list'),
    path('inventory/movement/', views.StockMovementCreateView.as_view(), name='stock-movement-create'),

    # Sales
    path('sales/', views.SaleListView.as_view(), name='sale-list'),
    path('sales/create/', views.SaleCreateView.as_view(), name='sale-create'),

    # Mess
    path('mess/sessions/', views.MessSessionListView.as_view(), name='mess-session-list'),
    path('mess/sessions/<int:pk>/', views.MessSessionDetailView.as_view(), name='mess-session-detail'),
    path('mess/sessions/create/', views.MessSessionCreateView.as_view(), name='mess-session-create'),
    path('mess/records/create/', views.MessRecordCreateView.as_view(), name='mess-record-create'),
    path('mess/my-history/', views.StudentMessHistoryView.as_view(), name='mess-my-history'),

    # Reports
    path('reports/sales-by-food-point/', views.ReportSalesByFoodPointView.as_view(), name='report-sales-fp'),
    path('reports/low-stock/', views.ReportLowStockView.as_view(), name='report-low-stock'),
]
