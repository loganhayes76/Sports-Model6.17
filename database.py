import sqlite3

# This is the name of the file that will store all your app's data
DB_NAME = "vls_platform.db"


def init_db():
    print("Building VLS Database Schema...")
    # Connect to the database (this creates the file if it doesn't exist)
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # --- TABLE 1: USERS ---
    # Manages logins, Stripe status, and personalized defaults
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        stripe_customer_id TEXT,
        subscription_tier TEXT DEFAULT 'free',
        favorite_team TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    print("✅ Users table created.")

    # --- TABLE 2: CUSTOM WIDGET LAYOUTS ---
    # Acts as the "Lego brick" memory for each user's home screen
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_widget_layouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        widget_id TEXT NOT NULL,
        position_index INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    print("✅ Widget Layouts table created.")

    # --- TABLE 3: DAILY PARLAYS ---
    # Stores the +100 algorithm outputs so the frontend loads them instantly
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_parlays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        sport TEXT NOT NULL,
        leg_1_details TEXT NOT NULL,
        leg_2_details TEXT NOT NULL,
        combined_odds TEXT NOT NULL,
        result TEXT DEFAULT 'Pending'
    )
    """)
    print("✅ Daily Parlays table created.")

    # Save changes and close the connection
    conn.commit()
    conn.close()
    print("🚀 Database successfully initialized!")


if __name__ == "__main__":
    init_db()
