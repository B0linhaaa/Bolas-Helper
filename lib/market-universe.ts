export type MarketKind = "stock" | "crypto";

export type UniverseAsset = {
  kind: MarketKind;
  symbol: string;
  name: string;
};

export const FAMOUS_STOCKS: UniverseAsset[] = [
  { kind: "stock", symbol: "AAPL", name: "Apple" },
  { kind: "stock", symbol: "MSFT", name: "Microsoft" },
  { kind: "stock", symbol: "NVDA", name: "NVIDIA" },
  { kind: "stock", symbol: "GOOGL", name: "Alphabet" },
  { kind: "stock", symbol: "AMZN", name: "Amazon" },
  { kind: "stock", symbol: "META", name: "Meta" },
  { kind: "stock", symbol: "TSLA", name: "Tesla" },
  { kind: "stock", symbol: "JPM", name: "JPMorgan" },
  { kind: "stock", symbol: "V", name: "Visa" },
  { kind: "stock", symbol: "ASML", name: "ASML" },
  { kind: "stock", symbol: "MC.PA", name: "LVMH" },
  { kind: "stock", symbol: "SAP.DE", name: "SAP" },
  { kind: "stock", symbol: "GALP.LS", name: "Galp" },
  { kind: "stock", symbol: "EDP.LS", name: "EDP" },
  { kind: "stock", symbol: "BCP.LS", name: "BCP" },
  { kind: "stock", symbol: "JMT.LS", name: "Jerónimo Martins" },
  { kind: "stock", symbol: "SON.LS", name: "Sonae" },
  { kind: "stock", symbol: "NOS.LS", name: "NOS" },
];

export const FAMOUS_CRYPTO: UniverseAsset[] = [
  { kind: "crypto", symbol: "BTC-USD", name: "Bitcoin" },
  { kind: "crypto", symbol: "ETH-USD", name: "Ethereum" },
  { kind: "crypto", symbol: "SOL-USD", name: "Solana" },
  { kind: "crypto", symbol: "XRP-USD", name: "XRP" },
  { kind: "crypto", symbol: "BNB-USD", name: "BNB" },
  { kind: "crypto", symbol: "ADA-USD", name: "Cardano" },
  { kind: "crypto", symbol: "DOGE-USD", name: "Dogecoin" },
  { kind: "crypto", symbol: "AVAX-USD", name: "Avalanche" },
  { kind: "crypto", symbol: "DOT-USD", name: "Polkadot" },
  { kind: "crypto", symbol: "LINK-USD", name: "Chainlink" },
  { kind: "crypto", symbol: "SUI-USD", name: "Sui" },
  { kind: "crypto", symbol: "LTC-USD", name: "Litecoin" },
];

export function universeFor(kind: MarketKind): UniverseAsset[] {
  return kind === "crypto" ? FAMOUS_CRYPTO : FAMOUS_STOCKS;
}
