---
name: indexa-capital-integration
description: Specialist guide for the Indexa Capital integration. Details API endpoints, credentials authentication, operation mappings, and local logo assets configuration.
license: MIT
metadata:
  author: Alberto Martínez Ballesteros
  version: '1.0.0'
---

# Indexa Capital Integration Details & API Reference

This skill documents the technical details of the Indexa Capital integration, including their personal REST API endpoints, security authentication, mapping rules, and the asset pipeline used for logos.

---

## 1. Authentication & Base Configuration

- **API Base URL**: `https://api.indexacapital.com`
- **Authentication Method**: Token-based auth via custom header `X-AUTH-TOKEN` mapping user tokens directly.
- **Base Currency**: EUR (all portfolios and asset profiles are traded and valued in Euros).
- **Credentials Validation**: Validated by making a test request to `GET /users/me`.

---

## 2. API Endpoints Reference

The following endpoints are queried by the Indexa Capital provider service:

### 1. Retrieve User Details

- **Path**: `GET /users/me`
- **Purpose**: Verify credentials. Returns 200 OK for valid tokens.

### 2. Fetch User Accounts

- **Path**: `GET /user/accounts`
- **Purpose**: Returns all linked portfolios under the token.
- **Handling**: Ghostfolio filters out inactive accounts (`status !== 'active'`) and creates one matching portfolio entry for each active one.

### 3. Fetch Account Details (Currency check)

- **Path**: `GET /accounts/:accountNumber`
- **Purpose**: Read the explicit portfolio settings (such as base currency, typically EUR).

### 4. Fetch Portfolio Holdings & Cash

- **Path**: `GET /accounts/:accountNumber/portfolio`
- **Purpose**: Returns current valuations, holdings, cash, and balances.
- **Response Structure**:
  - **Cash Balance**: Read from `portfolio.cash_amount` (numeric float value).
  - **Holdings**: Extracted from `instrument_accounts[].positions[]`. Each position exposes the security name, quantity (`titles`), unit price (`price`), and ISIN identification code (`instrument.isin_code`).

### 5. Fetch Transactions History

- **Path**: `GET /accounts/:accountNumber/instrument-transactions`
- **Purpose**: Fetch historical transactions (buy and sell orders) to build the operations log.
- **Date Filter**: If a synchronization baseline date is specified, transactions before that timestamp are filtered out to prevent duplicate inserts.

---

## 3. Operations & Asset Mapping

To integrate external transactions into Ghostfolio orders, they must map to standard type values (`BUY` or `SELL`).

### Operation Type Codes Mapping

The provider checks both the raw `operation_code` and the localized `operation_type` description:

| Operation Code | Operation Type                     | Ghostfolio Order Type |
| -------------- | ---------------------------------- | --------------------- |
| **20**         | _Contains "SUSCRIPCIÓN" or "ALTA"_ | **BUY**               |
| **1370**       | _Contains "SUSCRIPCIÓN" or "ALTA"_ | **BUY**               |
| **1371**       | _Contains "SUSCRIPCIÓN" or "ALTA"_ | **BUY**               |
| **21**         | _Contains "REEMBOLSO" or "BAJA"_   | **SELL**              |
| **1339**       | _Contains "REEMBOLSO" or "BAJA"_   | **SELL**              |
| **1372**       | _Contains "REEMBOLSO" or "BAJA"_   | **SELL**              |

_Transactions that do not match these criteria are skipped (e.g. transfers between internal funds, management fees, or other non-buy/sell actions)._

### Transaction Sorting

External transactions are sorted chronologically (**oldest first**) based on the transaction `date` property before importing. This ensures that cash balances and order timelines recalculate in the correct sequence.

---

## 4. Local Brand Logo Interception

To comply with local branding policies and avoid external requests, the Indexa logo is bundled directly inside the project:

- **Asset path**: `apps/api/src/assets/indexa-capital.png`
- **Interception logic**: Configured in `LogoService.getLogoByUrl(aUrl)` in `apps/api/src/app/logo/logo.service.ts`:
  - Intercepts requests pointing to `https://indexacapital.com`.
  - Searches for `indexa-capital.png` inside the compiled output (`dist/apps/api/assets/indexa-capital.png`) or project source.
  - Returns the local buffer directly as `image/png` content.
  - Fails with a `NOT_FOUND` exception rather than making any internet callbacks if local asset reading fails.
- **Git status**: Ensure `apps/api/src/assets/indexa-capital.png` is tracked and committed.
