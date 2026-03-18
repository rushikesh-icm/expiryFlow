# DhanHQ Ver 2.0 - API Reference

## Table of Contents

- [Annexure](#annexure)
  - [Exchange Segment](#exchange-segment)
  - [Product Type](#product-type)
  - [Order Status](#order-status)
  - [After Market Order Time](#after-market-order-time)
  - [Expiry Code](#expiry-code)
  - [Instrument](#instrument)
  - [Feed Request Code](#feed-request-code)
  - [Feed Response Code](#feed-response-code)
  - [Trading API Error](#trading-api-error)
  - [Data API Error](#data-api-error)
  - [Conditional Triggers](#conditional-triggers)
    - [Comparison Type](#comparison-type)
    - [Indicator Name](#indicator-name)
    - [Operator](#operator)
    - [Status](#status)
- [Expired Options Data](#expired-options-data)
  - [Historical Rolling Data](#historical-rolling-data)
  - [Request Structure](#request-structure)
  - [Parameters](#parameters)
  - [Response Structure](#response-structure)

---

## Annexure

### Exchange Segment

| Attribute    | Exchange | Segment           | enum |
|--------------|----------|-------------------|------|
| IDX_I        | Index    | Index Value       | 0    |
| NSE_EQ       | NSE      | Equity Cash       | 1    |
| NSE_FNO      | NSE      | Futures & Options | 2    |
| NSE_CURRENCY | NSE      | Currency          | 3    |
| BSE_EQ       | BSE      | Equity Cash       | 4    |
| MCX_COMM     | MCX      | Commodity         | 5    |
| BSE_CURRENCY | BSE      | Currency          | 7    |
| BSE_FNO      | BSE      | Futures & Options | 8    |

---

### Product Type

| Attribute | Detail                                 |
|-----------|----------------------------------------|
| CNC       | Cash & Carry for equity deliveries     |
| INTRADAY  | Intraday for Equity, Futures & Options |
| MARGIN    | Carry Forward in Futures & Options     |

---

### Order Status

| Attribute   | Detail                                                                      |
|-------------|-----------------------------------------------------------------------------|
| TRANSIT     | Did not reach the exchange server                                           |
| PENDING     | Awaiting execution                                                          |
| CLOSED      | Used for Super Order, once both the entry and exit orders are placed        |
| TRIGGERED   | Used for Super Order, if Target or Stop Loss leg is triggered               |
| REJECTED    | Rejected by broker/exchange                                                 |
| CANCELLED   | Cancelled by user                                                           |
| PART_TRADED | Partial Quantity traded successfully                                        |
| TRADED      | Executed successfully                                                       |

---

### After Market Order Time

| Attribute | Detail                                  |
|-----------|-----------------------------------------|
| PRE_OPEN  | AMO pumped at pre-market session        |
| OPEN      | AMO pumped at market open               |
| OPEN_30   | AMO pumped 30 minutes after market open |
| OPEN_60   | AMO pumped 60 minutes after market open |

---

### Expiry Code

| Attribute | Detail                     |
|-----------|----------------------------|
| 0         | Current Expiry/Near Expiry |
| 1         | Next Expiry                |
| 2         | Far Expiry                 |

---

### Instrument

| Attribute | Detail                       |
|-----------|------------------------------|
| INDEX     | Index                        |
| FUTIDX    | Futures of Index             |
| OPTIDX    | Options of Index             |
| EQUITY    | Equity                       |
| FUTSTK    | Futures of Stock             |
| OPTSTK    | Options of Stock             |
| FUTCOM    | Futures of Commodity         |
| OPTFUT    | Options of Commodity Futures |
| FUTCUR    | Futures of Currency          |
| OPTCUR    | Options of Currency          |

---

### Feed Request Code

| Attribute | Detail                          |
|-----------|---------------------------------|
| 11        | Connect Feed                    |
| 12        | Disconnect Feed                 |
| 15        | Subscribe - Ticker Packet       |
| 16        | Unsubscribe - Ticker Packet     |
| 17        | Subscribe - Quote Packet        |
| 18        | Unsubscribe - Quote Packet      |
| 21        | Subscribe - Full Packet         |
| 22        | Unsubscribe - Full Packet       |
| 23        | Subscribe - Full Market Depth   |
| 25        | Unsubscribe - Full Market Depth |

---

### Feed Response Code

| Attribute | Detail               |
|-----------|----------------------|
| 1         | Index Packet         |
| 2         | Ticker Packet        |
| 4         | Quote Packet         |
| 5         | OI Packet            |
| 6         | Prev Close Packet    |
| 7         | Market Status Packet |
| 8         | Full Packet          |
| 50        | Feed Disconnect      |

---

### Trading API Error

| Type                   | Code   | Message                                                                                                                    |
|------------------------|--------|----------------------------------------------------------------------------------------------------------------------------|
| Invalid Authentication | DH-901 | Client ID or user generated access token is invalid or expired.                                                            |
| Invalid Access         | DH-902 | User has not subscribed to Data APIs or does not have access to Trading APIs. Kindly subscribe to Data APIs to fetch Data. |
| User Account           | DH-903 | Errors related to User's Account. Check if the required segments are activated or other requirements are met.              |
| Rate Limit             | DH-904 | Too many requests on server from single user breaching rate limits. Try throttling API calls.                              |
| Input Exception        | DH-905 | Missing required fields, bad values for parameters etc.                                                                    |
| Order Error            | DH-906 | Incorrect request for order and cannot be processed.                                                                       |
| Data Error             | DH-907 | System is unable to fetch data due to incorrect parameters or no data present.                                             |
| Internal Server Error  | DH-908 | Server was not able to process API request. This will only occur rarely.                                                   |
| Network Error          | DH-909 | Network error where the API was unable to communicate with the backend system.                                             |
| Others                 | DH-910 | Error originating from other reasons.                                                                                      |

---

### Data API Error

| Code | Description                                                                              |
|------|------------------------------------------------------------------------------------------|
| 800  | Internal Server Error                                                                    |
| 804  | Requested number of instruments exceeds limit                                            |
| 805  | Too many requests or connections. Further requests may result in the user being blocked. |
| 806  | Data APIs not subscribed                                                                 |
| 807  | Access token is expired                                                                  |
| 808  | Authentication Failed - Client ID or Access Token invalid                                |
| 809  | Access token is invalid                                                                  |
| 810  | Client ID is invalid                                                                     |
| 811  | Invalid Expiry Date                                                                      |
| 812  | Invalid Date Format                                                                      |
| 813  | Invalid SecurityId                                                                       |
| 814  | Invalid Request                                                                          |

---

## Conditional Triggers

### Comparison Type

| Type                     | Description                                          | Mandatory Fields                                        |
|--------------------------|------------------------------------------------------|---------------------------------------------------------|
| TECHNICAL_WITH_VALUE     | Compare technical indicator against a fixed numeric value | `indicatorName`, `operator`, `timeFrame`, `comparingValue` |
| TECHNICAL_WITH_INDICATOR | Compare technical indicator against another indicator | `indicatorName`, `operator`, `timeFrame`, `comparingIndicatorName` |
| TECHNICAL_WITH_CLOSE     | Compare a technical indicator with closing price     | `indicatorName`, `operator`, `timeFrame`                |
| PRICE_WITH_VALUE         | Compare market price against fixed value             | `operator`, `comparingValue`                            |

---

### Indicator Name

| Indicator   | Description                              |
|-------------|------------------------------------------|
| SMA_5       | Simple Moving Average (5 periods)        |
| SMA_10      | Simple Moving Average (10 periods)       |
| SMA_20      | Simple Moving Average (20 periods)       |
| SMA_50      | Simple Moving Average (50 periods)       |
| SMA_100     | Simple Moving Average (100 periods)      |
| SMA_200     | Simple Moving Average (200 periods)      |
| EMA_5       | Exponential Moving Average (5 periods)   |
| EMA_10      | Exponential Moving Average (10 periods)  |
| EMA_20      | Exponential Moving Average (20 periods)  |
| EMA_50      | Exponential Moving Average (50 periods)  |
| EMA_100     | Exponential Moving Average (100 periods) |
| EMA_200     | Exponential Moving Average (200 periods) |
| BB_UPPER    | Upper Bollinger Band                     |
| BB_LOWER    | Lower Bollinger Band                     |
| RSI_14      | Relative Strength Index                  |
| ATR_14      | Average True Range                       |
| STOCHASTIC  | Stochastic Oscillator                    |
| STOCHRSI_14 | Stochastic RSI                           |
| MACD_26     | MACD long-term component                 |
| MACD_12     | MACD short-term component                |
| MACD_HIST   | MACD histogram                           |

---

### Operator

| Operator            | Description          |
|---------------------|----------------------|
| CROSSING_UP         | Crosses above        |
| CROSSING_DOWN       | Crosses below        |
| CROSSING_ANY_SIDE   | Crosses either side  |
| GREATER_THAN        | Greater than         |
| LESS_THAN           | Less than            |
| GREATER_THAN_EQUAL  | Greater than or equal|
| LESS_THAN_EQUAL     | Less than or equal   |
| EQUAL               | Equal                |
| NOT_EQUAL           | Not equal            |

---

### Status

| Status    | Description               |
|-----------|---------------------------|
| ACTIVE    | Alert is currently active |
| TRIGGERED | Alert condition met       |
| EXPIRED   | Alert expired             |
| CANCELLED | Alert cancelled           |

---

## Expired Options Data

This API provides expired options contract data on a rolling basis. You can fetch the last 5 years of strike-wise data based on ATM and up to 10 strikes above and below. Data fields include open, high, low, close, implied volatility, volume, open interest, and spot information.

> **Note:** "ATM" refers to At The Money. For index options nearing expiry, strikes will be available up to ATM +10 and ATM -10. For all other contracts, strikes will be available up to ATM +3 and ATM -3.

| Method | Endpoint               | Description                               |
|--------|------------------------|-------------------------------------------|
| POST   | `/charts/rollingoption` | Get Continuous Expired Options Contract data |

---

### Historical Rolling Data

Fetch expired options data on a rolling basis, along with Open Interest, Implied Volatility, OHLC, Volume, and spot information. You can fetch up to 30 days of data in a single API call. Expired options data is stored at the minute level, based on strike price relative to spot (e.g., ATM, ATM+1, ATM-1, etc.).

Data is available for up to the last 5 years, covering both Index Options and Stock Options.

---

### Request Structure

```bash
curl --request POST \
  --url https://api.dhan.co/v2/charts/rollingoption \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header 'access-token: <your_access_token>' \
  --data '{
    "exchangeSegment": "NSE_FNO",
    "interval": "1",
    "securityId": 13,
    "instrument": "OPTIDX",
    "expiryFlag": "MONTH",
    "expiryCode": 1,
    "strike": "ATM",
    "drvOptionType": "CALL",
    "requiredData": [
      "open",
      "high",
      "low",
      "close",
      "volume"
    ],
    "fromDate": "2021-08-01",
    "toDate": "2021-09-01"
  }'
```

---

### Parameters

| Field            | Field Type      | Required | Description                                                                                                       |
|------------------|-----------------|----------|-------------------------------------------------------------------------------------------------------------------|
| exchangeSegment  | enum (string)   | Yes      | Exchange & segment for which data is to be fetched. Refer [Exchange Segment](#exchange-segment)                   |
| interval         | enum (integer)  | Yes      | Minute intervals in timeframe: `1`, `5`, `15`, `25`, `60`                                                        |
| securityId       | string          | Yes      | Underlying exchange standard ID for each scrip                                                                    |
| instrument       | enum (string)   | Yes      | Instrument type of the scrip. Refer [Instrument](#instrument)                                                     |
| expiryCode       | enum (integer)  | Yes      | Expiry of the instruments. Refer [Expiry Code](#expiry-code)                                                      |
| expiryFlag       | enum (string)   | Yes      | Expiry interval of the instrument: `WEEK` or `MONTH`                                                              |
| strike           | enum (string)   | Yes      | `ATM` for At the Money. Up to `ATM+10` / `ATM-10` for Index Options near expiry. Up to `ATM+3` / `ATM-3` for all other contracts |
| drvOptionType    | enum (string)   | Yes      | `CALL` or `PUT`                                                                                                   |
| requiredData     | array []        | Yes      | Array of required data fields: `open`, `high`, `low`, `close`, `iv`, `volume`, `strike`, `oi`, `spot`            |
| fromDate         | string          | Yes      | Start date of the desired range (format: `YYYY-MM-DD`)                                                            |
| toDate           | string          | Yes      | End date of the desired range, non-inclusive (format: `YYYY-MM-DD`)                                               |

---

### Response Structure

```json
{
  "data": {
    "ce": {
      "iv": [],
      "oi": [],
      "strike": [],
      "spot": [],
      "open": [354, 360.3],
      "high": [],
      "low": [],
      "close": [],
      "volume": [],
      "timestamp": [1756698300, 1756699200]
    },
    "pe": null
  }
}
```

#### Response Fields

| Field     | Field Type | Description                    |
|-----------|------------|--------------------------------|
| open      | float      | Open price of the timeframe    |
| high      | float      | High price in the timeframe    |
| low       | float      | Low price in the timeframe     |
| close     | float      | Close price of the timeframe   |
| volume    | int        | Volume traded in the timeframe |
| timestamp | int        | Epoch timestamp                |

> **Note:** For description of enum values, refer to the [Annexure](#annexure) section above.