CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE,
    sync_token INTEGER
);

CREATE TABLE app_configurations (
    id SERIAL PRIMARY KEY,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    user_id INTEGER UNIQUE,
    total_unit VARCHAR(10) NOT NULL,
    item_unit VARCHAR(10) NOT NULL,
    last_list INTEGER, -- default list
    id_sequence INTEGER NOT NULL DEFAULT 0, -- sequence
    show_sidebar BOOLEAN NOT NULL DEFAULT TRUE,
    show_images BOOLEAN NOT NULL DEFAULT FALSE,
    show_prices BOOLEAN NOT NULL DEFAULT FALSE,
    show_worn BOOLEAN NOT NULL DEFAULT TRUE,
    show_consumable BOOLEAN NOT NULL DEFAULT TRUE,
    show_list_description BOOLEAN NOT NULL DEFAULT FALSE,
    currency_symbol CHAR(1),
    CONSTRAINT fk__app_configurations__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE gear_lists (
    id SERIAL PRIMARY KEY,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    library_id INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    user_id INTEGER,
    external_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_weight NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_worn_weight NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_consumable_weight NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_base_weight NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_pack_weight NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_consumable_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_qty INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, library_id),
    CONSTRAINT fk__gear_lists__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE gear_list_positions (
    id SERIAL PRIMARY KEY,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    user_id INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    gear_list_library_id INTEGER,
    position INTEGER,
    UNIQUE (user_id, gear_list_library_id),
    CONSTRAINT fk__gear_list_positions__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk__gear_list_positions__gear_list FOREIGN KEY (user_id, gear_list_library_id) REFERENCES gear_lists(user_id, library_id) ON DELETE CASCADE
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    library_id INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    user_id INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    gear_list_library_id INTEGER,
    name VARCHAR(255) NOT NULL,
    subtotal_weight  NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    subtotal_worn_weight  NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    subtotal_consumable_weight  NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    subtotal_price  NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    subtotal_consumable_price  NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    subtotal_qty INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, library_id),
    CONSTRAINT fk__categories__gear_list FOREIGN KEY (user_id, gear_list_library_id) REFERENCES gear_lists(user_id, library_id) ON DELETE CASCADE
);

CREATE TABLE category_positions (
    id SERIAL PRIMARY KEY,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    user_id INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    gear_list_library_id INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    category_library_id INTEGER,
    position INTEGER,
    UNIQUE (user_id, gear_list_library_id, category_library_id),
    CONSTRAINT fk__category_positions__gear_list FOREIGN KEY (user_id, gear_list_library_id) REFERENCES gear_lists(user_id, library_id) ON DELETE CASCADE,
    CONSTRAINT fk__category_positions__category FOREIGN KEY (user_id, category_library_id) REFERENCES categories(user_id, library_id) ON DELETE CASCADE
);

CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    library_id INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    user_id INTEGER,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    weight_unit VARCHAR(10) NOT NULL,
    price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    image_url TEXT,
    url TEXT,
    UNIQUE (user_id, library_id),
    CONSTRAINT fk__items__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE item_positions (
    id SERIAL PRIMARY KEY,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    user_id INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    category_library_id INTEGER,
    item_library_id INTEGER,
    position INTEGER,
    -- We have to allow null to allow for cascade delete to work with prisma
    -- See: https://github.com/prisma/prisma/issues/2057
    qty INTEGER NOT NULL DEFAULT 1,
    is_worn BOOLEAN NOT NULL DEFAULT FALSE,
    is_consumable BOOLEAN NOT NULL DEFAULT FALSE,
    star INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, category_library_id, item_library_id),
    CONSTRAINT fk__item_positions__category FOREIGN KEY (user_id, category_library_id) REFERENCES categories(user_id, library_id) ON DELETE CASCADE,
    CONSTRAINT fk__item_positions__item FOREIGN KEY (user_id, item_library_id) REFERENCES items(user_id, library_id) ON DELETE CASCADE
);
