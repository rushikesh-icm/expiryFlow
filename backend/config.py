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

LOT_SIZES = {
    "NIFTY": 65,
    "BANKNIFTY": 30,
    "SENSEX": 20,
}

# Margin & commission constants
MARGIN_RATE = 0.1133  # 11.33% of spot x lot_size
BROKERAGE_PER_ORDER = 20  # ₹20 per executed order
STT_SELL_RATE = 0.001  # 0.1% on sell side
EXCHANGE_TXN_RATE = 0.0003553  # 0.03553% on total turnover
GST_RATE = 0.18  # 18% on (brokerage + exchange txn)
SEBI_PER_CRORE = 10  # ₹10 per crore
STAMP_DUTY_BUY_RATE = 0.00004  # 0.004% on buy side
