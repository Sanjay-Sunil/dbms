erDiagram
    FOOD_POINT ||--o{ STAFF_ASSIGNMENT : has
    APP_USER ||--o{ STAFF_ASSIGNMENT : assigned_as
    FOOD_POINT ||--o{ MENU_ITEM : offers
    MENU_ITEM ||--o{ MENU_RECIPE : requires
    INGREDIENT ||--o{ MENU_RECIPE : used_in
    FOOD_POINT ||--o{ INVENTORY_STOCK : stores
    INGREDIENT ||--o{ INVENTORY_STOCK : tracked_as
    FOOD_POINT ||--o{ SALE : records
    APP_USER ||--o{ SALE : records_as_staff
    APP_USER o|--o{ SALE : may_be_customer
    SALE ||--|{ SALE_ITEM : contains
    MENU_ITEM ||--o{ SALE_ITEM : sold_as
    FOOD_POINT ||--o{ STOCK_MOVEMENT : has
    INGREDIENT ||--o{ STOCK_MOVEMENT : movement_for
    SALE o|--o{ STOCK_MOVEMENT : may_trigger
    FOOD_POINT ||--o{ MESS_MEAL_SESSION : hosts
    APP_USER ||--o{ MESS_MEAL_SESSION : creates
    MESS_MEAL_SESSION ||--o{ MESS_MEAL_RECORD : includes
    APP_USER ||--o{ MESS_MEAL_RECORD : student
    APP_USER ||--o{ MESS_MEAL_RECORD : recorded_by

    FOOD_POINT {
        int food_point_id PK
        varchar name UK
        enum point_type
        varchar location_description
        boolean is_active
    }
    APP_USER {
        int user_id PK
        varchar username UK
        varchar password_hash
        varchar full_name
        enum role
        varchar student_roll_no UK
        varchar email UK
        boolean is_active
    }
    STAFF_ASSIGNMENT {
        int staff_assignment_id PK
        int staff_user_id FK
        int food_point_id FK
        date assigned_from
        date assigned_until
        boolean is_active
    }
    MENU_ITEM {
        int menu_item_id PK
        int food_point_id FK
        varchar item_name
        varchar category
        decimal current_price
        boolean is_available
    }
    INGREDIENT {
        int ingredient_id PK
        varchar ingredient_name UK
        enum unit_of_measure
        boolean is_active
    }
    INVENTORY_STOCK {
        int food_point_id PK,FK
        int ingredient_id PK,FK
        decimal quantity_on_hand
        decimal reorder_level
    }
    MENU_RECIPE {
        int menu_item_id PK,FK
        int ingredient_id PK,FK
        decimal quantity_required
    }
    SALE {
        bigint sale_id PK
        int food_point_id FK
        int recorded_by FK
        int student_user_id FK
        datetime sale_datetime
        enum payment_method
        enum payment_status
        decimal total_amount
    }
    SALE_ITEM {
        bigint sale_item_id PK
        bigint sale_id FK
        int menu_item_id FK
        int quantity
        decimal unit_price
    }
    STOCK_MOVEMENT {
        bigint movement_id PK
        int food_point_id FK
        int ingredient_id FK
        enum movement_type
        decimal quantity_change
        bigint sale_id FK
        int recorded_by FK
        timestamp created_at
    }
    MESS_MEAL_SESSION {
        bigint session_id PK
        int food_point_id FK
        date session_date
        enum meal_type
        int created_by FK
    }
    MESS_MEAL_RECORD {
        bigint meal_record_id PK
        bigint session_id FK
        int student_user_id FK
        enum attendance_status
        decimal amount_due
        enum payment_status
        int recorded_by FK
    }
