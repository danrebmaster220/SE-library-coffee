# POS Authorization Regression Checklist

## Scope
- Validate cashier transaction ownership isolation.
- Validate admin full-access behavior.
- Validate kiosk unassigned flow behavior.

## Preconditions
- Admin account
- Cashier A account
- Cashier B account
- At least one unassigned kiosk pending transaction
- At least one transaction owned by each cashier

## Test Matrix

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| POS-AUTH-01 | Cashier A completed/refunded visibility | Login as Cashier A and open Completed and Refund pages | Only Cashier A records appear |
| POS-AUTH-02 | Cashier B completed/refunded visibility | Login as Cashier B and open Completed and Refund pages | Only Cashier B records appear |
| POS-AUTH-03 | Cross-cashier detail read block | Cashier A calls GET /pos/transactions/:id for Cashier B transaction | 403 Access denied |
| POS-AUTH-04 | Cross-cashier modify block | Cashier A attempts preparing/ready/complete/void/refund/remove-items on Cashier B transaction | 403 Access denied on each write action |
| POS-AUTH-05 | Own transaction modify allow | Cashier A performs same write actions on own transaction | Actions succeed |
| POS-AUTH-06 | Unassigned kiosk pay allow | Cashier A performs PUT /pos/transactions/:id/pay on kiosk unassigned pending transaction | Action succeeds and transaction is attributed to acting cashier |
| POS-AUTH-07 | Admin global read/write allow | Admin performs read and write actions on transactions from both cashiers | All intended actions succeed |
| POS-AUTH-08 | Post-action consistency | Re-open completed/voided/refunded/history views after tests | Successful actions reflected, blocked actions made no data changes |

## API Endpoints to Validate
- GET /pos/transactions/:id
- GET /pos/transactions/completed
- GET /pos/transactions/voided
- GET /pos/transactions/refunded
- PUT /pos/order/:id/preparing
- PUT /pos/orders/:id/ready
- PUT /pos/orders/:id/complete
- PUT /pos/transactions/:id/pay
- POST /pos/transactions/:id/void
- POST /pos/transactions/:id/refund
- PUT /pos/transactions/:id/remove-items

## Pass Criteria
- No cross-cashier data mutation is possible for non-admin users.
- Cashier read/write access is limited to own transactions plus allowed unassigned kiosk paths.
- Admin behavior remains unchanged.
