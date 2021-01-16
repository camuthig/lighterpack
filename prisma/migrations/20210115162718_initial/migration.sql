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
    user_id INTEGER NOT NULL UNIQUE,
    total_unit VARCHAR(10) NOT NULL,
    item_unit VARCHAR(10) NOT NULL,
    last_list INTEGER, -- default list
    library_version INTEGER NOT NULL DEFAULT 0, -- sequence
    show_sidebar BOOLEAN NOT NULL DEFAULT TRUE,
    show_images BOOLEAN NOT NULL DEFAULT FALSE,
    show_prices BOOLEAN NOT NULL DEFAULT FALSE,
    show_worn BOOLEAN NOT NULL DEFAULT FALSE,
    show_consumable BOOLEAN NOT NULL DEFAULT FALSE,
    show_list_description BOOLEAN NOT NULL DEFAULT FALSE,
    currency_symbol CHAR(1),
    CONSTRAINT fk__app_configurations__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE gear_lists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    external_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- TODO Add other fields for weights and what not.
    CONSTRAINT fk__gear_lists__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE gear_list_positions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    gear_list_id INTEGER NOT NULL,
    UNIQUE (user_id, gear_list_id),
    CONSTRAINT fk__gear_list_positions__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk__gear_list_positions__gear_list_id FOREIGN KEY (gear_list_id) REFERENCES gear_lists(id) ON DELETE CASCADE
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    gear_list_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    CONSTRAINT fk__categories__gear_list_id FOREIGN KEY (gear_list_id) REFERENCES gear_lists(id) ON DELETE CASCADE
);

CREATE TABLE category_positions (
    id SERIAL PRIMARY KEY,
    gear_list_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    -- Add other fields for weight and what not.
    UNIQUE (gear_list_id, category_id),
    CONSTRAINT fk__category_positions__gear_list_id FOREIGN KEY (gear_list_id) REFERENCES gear_lists(id) ON DELETE CASCADE,
    CONSTRAINT fk__category_positions__category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    weight_unit VARCHAR(10) NOT NULL,
    price TEXT, -- TODO Figure out the expected definition for the price field
    image_url TEXT,
    url TEXT,
    CONSTRAINT fk__items__user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE item_positions (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    UNIQUE (category_id, item_id),
    CONSTRAINT fk__item_positions__category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT fk__item_positions__item_id FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

