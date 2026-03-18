DHAN_AUTH_BASE_URL = "https://auth.dhan.co"
DHAN_API_BASE_URL = "https://api.dhan.co"

AUTH_RATE_LIMIT_MAX = 5
AUTH_RATE_LIMIT_WINDOW = 60
GENERAL_RATE_LIMIT_MAX = 60
GENERAL_RATE_LIMIT_WINDOW = 60

SESSION_CHECK_BUFFER_MINUTES = 5

# Data API
DHAN_DATA_BASE_URL = "https://api.dhan.co"
DATA_RATE_LIMIT_PER_SECOND = 5
DATA_RATE_LIMIT_PER_DAY = 100_000

OPTION_TYPES = ["CE", "PE"]

# Underlying metadata from Dhan security master (docs/secuirty.csv)
UNDERLYING_META = {
    "NIFTY": {
        "security_id": 13,
        "exchange_segment": "NSE_FNO",
        "instrument": "OPTIDX",
        "strike_step": 50,
    },
    "BANKNIFTY": {
        "security_id": 25,
        "exchange_segment": "NSE_FNO",
        "instrument": "OPTIDX",
        "strike_step": 100,
    },
    "SENSEX": {
        "security_id": 51,
        "exchange_segment": "BSE_FNO",
        "instrument": "OPTIDX",
        "strike_step": 100,
    },
}

SUPPORTED_UNDERLYINGS = list(UNDERLYING_META.keys())
