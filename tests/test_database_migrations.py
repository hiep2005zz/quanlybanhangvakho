from sqlalchemy import create_engine, inspect, text

from app.db.init_db import _ensure_dealer_credit_limit_column


def test_migrates_existing_dealers_table_with_credit_limit_default():
    engine = create_engine("sqlite://")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE dealers (id INTEGER PRIMARY KEY)"))
            connection.execute(text("INSERT INTO dealers (id) VALUES (1)"))

        _ensure_dealer_credit_limit_column(engine)
        _ensure_dealer_credit_limit_column(engine)

        assert "credit_limit" in {
            column["name"] for column in inspect(engine).get_columns("dealers")
        }
        with engine.connect() as connection:
            assert connection.execute(
                text("SELECT credit_limit FROM dealers WHERE id = 1")
            ).scalar_one() == 50000000.0
    finally:
        engine.dispose()
