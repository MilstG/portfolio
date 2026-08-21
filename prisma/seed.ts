import { PrismaClient, AssetType, Frequency, TransactionType, TransactionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.transaction.deleteMany();
  await prisma.recurringIncome.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.account.deleteMany();
  await prisma.netWorthSnapshot.deleteMany();
  await prisma.exchangeRate.deleteMany();

  await prisma.exchangeRate.create({
    data: { from: "ARS", to: "USD", rate: 1451.67, source: "average", date: new Date() },
  });

  const santander = await prisma.account.create({
    data: { name: "Banco Santander USD", institution: "Banco Santander", type: "bank", currency: "USD", balance: 4200 },
  });

  await prisma.account.create({ data: { name: "Banco Galicia ARS", institution: "Banco Galicia", type: "bank", currency: "ARS", balance: 2450000 } });
  await prisma.account.create({ data: { name: "Binance USDT", institution: "Binance", type: "exchange", currency: "USDT", balance: 3150 } });
  await prisma.account.create({ data: { name: "Interactive Brokers Cash", institution: "Interactive Brokers", type: "broker", currency: "USD", balance: 1800 } });
  await prisma.account.create({ data: { name: "Efectivo físico", institution: "Efectivo", type: "physical", currency: "ARS", balance: 320 } });

  const btc = await prisma.asset.create({
    data: { name: "Bitcoin", ticker: "BTC", type: AssetType.CRYPTO, quantity: 0.85, costBasis: 44350, currentValue: 52400, currency: "USD", purchaseDate: new Date("2024-11-15") },
  });

  const aapl = await prisma.asset.create({
    data: { name: "Apple", ticker: "AAPL", type: AssetType.STOCK, quantity: 45, costBasis: 7650, currentValue: 8200, currency: "USD", purchaseDate: new Date("2025-03-10") },
  });

  const al30 = await prisma.asset.create({
    data: { name: "Bono AL30", ticker: "AL30", type: AssetType.BOND, quantity: 1, costBasis: 4800, currentValue: 5125, currency: "USD", purchaseDate: new Date("2025-01-20") },
  });

  const apto = await prisma.asset.create({
    data: { name: "Apartment CABA - Palermo", type: AssetType.REAL_ESTATE, quantity: 1, costBasis: 28500, currentValue: 35000, currency: "USD", purchaseDate: new Date("2023-06-01"), notes: "Propiedad en alquiler" },
  });

  await prisma.recurringIncome.create({
    data: { assetId: apto.id, name: "Alquiler Mensual", amount: 1200, currency: "USD", frequency: Frequency.MONTHLY, nextDate: new Date("2026-09-01"), dayOfMonth: 1, isActive: true },
  });

  await prisma.recurringIncome.create({
    data: { assetId: al30.id, name: "Cupón AL30", amount: 275, currency: "USD", frequency: Frequency.SEMI_ANNUAL, nextDate: new Date("2027-01-15"), isActive: true },
  });

  await prisma.transaction.createMany({
    data: [
      { date: new Date("2026-08-18"), description: "Bitcoin Purchase", amount: -1250, currency: "USD", type: TransactionType.BUY, category: "Crypto", status: TransactionStatus.COMPLETED, assetId: btc.id },
      { date: new Date("2026-08-17"), description: "AAPL Dividend", amount: 145.3, currency: "USD", type: TransactionType.DIVIDEND, category: "Stocks", status: TransactionStatus.COMPLETED, assetId: aapl.id },
      { date: new Date("2026-08-15"), description: "Rental Income – Palermo", amount: 1200, currency: "USD", type: TransactionType.RENT, category: "Real Estate", status: TransactionStatus.COMPLETED, assetId: apto.id },
      { date: new Date("2026-08-14"), description: "Transfer to Savings", amount: -500, currency: "USD", type: TransactionType.TRANSFER, category: "Cash", status: TransactionStatus.COMPLETED, accountId: santander.id },
      { date: new Date("2026-08-12"), description: "Cupón AL30", amount: 275, currency: "USD", type: TransactionType.COUPON, category: "Bonds", status: TransactionStatus.COMPLETED, assetId: al30.id },
    ],
  });

  const snapshots = [
    { date: "2025-05-01", total: 78000 }, { date: "2025-06-01", total: 82000 }, { date: "2025-07-01", total: 85500 },
    { date: "2025-08-01", total: 89000 }, { date: "2025-09-01", total: 91000 }, { date: "2025-10-01", total: 94500 },
    { date: "2025-11-01", total: 98000 }, { date: "2025-12-01", total: 102000 }, { date: "2026-01-01", total: 108000 },
    { date: "2026-02-01", total: 112500 }, { date: "2026-03-01", total: 117000 }, { date: "2026-04-01", total: 121000 },
    { date: "2026-05-01", total: 124850 },
  ];

  for (const s of snapshots) {
    await prisma.netWorthSnapshot.create({
      data: { date: new Date(s.date), totalUsd: s.total, breakdown: { crypto: 42300, stocks: 38100, realEstate: 35000, cash: 9450 } },
    });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
