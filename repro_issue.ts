
import { isTransactionRefund } from './services/invoiceBuilder';

const mercadinhoTx = {
    "id": "205fa428-043a-46bf-ab15-76c617bd3693",
    "description": "MERCADINHO TRES DE MAI",
    "amount": -16,
    "date": "2026-01-26",
    "category": "Groceries",
    "type": "expense",
    "status": "completed",
    "isProjected": false,
    "isPayment": false,
    "pluggyRaw": {
        "paymentData": null,
        "type": "DEBIT",
        "providerId": "0870000160T6100",
        "creditCardMetadata": {
            "payeeMCC": 5411,
            "cardNumber": "4442"
        },
        "category": "Groceries",
        "descriptionRaw": "MERCADINHO TRES DE MAI",
        "id": "205fa428-043a-46bf-ab15-76c617bd3693",
        "balance": null,
        "createdAt": "2026-01-28T10:29:49.049Z",
        "order": 3,
        "amountInAccountCurrency": null,
        "description": "MERCADINHO TRES DE MAI",
        "updatedAt": "2026-01-28T10:29:49.049Z",
        "merchant": null,
        "date": "2026-01-26T16:42:59.000Z",
        "amount": 16,
        "operationType": null,
        "currencyCode": "BRL",
        "status": "PENDING",
        "acquirerData": null,
        "categoryId": "10000000",
        "providerCode": null,
        "accountId": "b16a6782-7fc8-4117-a46e-8c36bb766ffa"
    }
};

const sheinTx = {
    "id": "2c299560-22d8-4622-9dbe-fec41f7d4807",
    "description": "Shein.com*SHEINCO",
    "amount": 156,
    "date": "2025-12-16",
    "category": "Clothing",
    "type": "income",
    "status": "completed",
    "isProjected": false,
    "isPayment": false,
    "pluggyRaw": {
        "status": "PENDING",
        "operationType": null,
        "providerId": "0870000139T6850",
        "creditCardMetadata": {
            "cardNumber": "4442",
            "payeeMCC": 5651
        },
        "amountInAccountCurrency": null,
        "amount": -156,
        "acquirerData": null,
        "id": "2c299560-22d8-4622-9dbe-fec41f7d4807",
        "paymentData": null,
        "categoryId": "08040000",
        "description": "Shein.com*SHEINCO",
        "merchant": {
            "name": "Shein",
            "businessName": "",
            "cnpj": ""
        },
        "createdAt": "2026-01-27T00:58:05.125Z",
        "date": "2025-12-16T03:00:00.000Z",
        "currencyCode": "BRL",
        "type": "CREDIT",
        "balance": null,
        "updatedAt": "2026-01-27T00:58:05.125Z",
        "providerCode": null,
        "accountId": "b16a6782-7fc8-4117-a46e-8c36bb766ffa",
        "category": "Clothing",
        "order": 0,
        "descriptionRaw": "Shein.com*SHEINCO"
    },
    "manualInvoiceMonth": "2026-01"
};

console.log("Check Mercadinho:", isTransactionRefund(mercadinhoTx));
console.log("Check Shein:", isTransactionRefund(sheinTx));
