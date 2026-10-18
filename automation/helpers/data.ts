// Test data, sourced from the pinned demo:
//   prices          src/postgresql/init.sql
//   EUR/USD rates   src/currency/src/server.cpp (EUR is the base, USD = 1.1305)
//   shipping        src/quote/app/routes.php (8.99 per item)

export const PRODUCTS = {
  explorascope: { id: 'OLJCESPC7Z', name: 'National Park Foundation Explorascope', usd: 101.96 },
  starsense: { id: '66VCHSJNUP', name: 'Starsense Explorer Refractor Telescope', usd: 349.95 },
  eclipsmart: { id: '1YMWWN1N4O', name: 'Eclipsmart Travel Refractor Telescope', usd: 129.95 },
  lensKit: { id: 'L9ECAV7KIM', name: 'Lens Cleaning Kit', usd: 21.95 },
  binoculars: { id: '2ZYFJ3GM2N', name: 'Roof Binoculars', usd: 209.95 },
  imager: { id: '0PUK6V6EV0', name: 'Solar System Color Imager', usd: 175.0 },
  flashlight: { id: 'LS4PSXUNUM', name: 'Red Flashlight', usd: 57.08 },
  tubeAssembly: { id: '9SIQT8TOJO', name: 'Optical Tube Assembly', usd: 3599.0 },
  solarFilter: { id: '6E92ZMYYFZ', name: 'Solar Filter', usd: 69.95 },
  cometBook: { id: 'HQTGWGPNH4', name: 'The Comet Book', usd: 0.99 },
} as const;

export const USD_PER_EUR = 1.1305;
export const SHIPPING_PER_ITEM_USD = 8.99;

export const CARDS = {
  visa: '4432-8015-6152-0454', // the checkout form's default
  mastercard: '5555-5555-5555-4444',
  amex: '378282246310005',
  luhnInvalid: '4432-8015-6152-0455',
} as const;

export const ADDRESS = {
  streetAddress: '1600 Amphitheatre Parkway',
  city: 'Mountain View',
  state: 'CA',
  country: 'United States',
  zipCode: '94043',
};

/** Known defects, referenced by knownDefect() in the tests. See test-cases/README.md. */
export const DEFECTS = {
  'DEF-01': 'Order cost differs from displayed price for prices with 1-9 cents',
  'DEF-02': 'Declined payment shows no message to the shopper',
  'DEF-03': 'Cart accepts negative quantities',
  'DEF-04': 'Expiry dropdown offers past months',
  'DEF-05': 'Unsupported currency code prices everything at zero, and the order goes through',
  'DEF-06': 'Payment does not validate CVV or expiry month range',
  'DEF-07': 'Unknown product ID is accepted into the cart, then the cart returns 500',
  'DEF-08': 'Converted prices drift below a cent (209.95 -> 209.949999999)',
  'DEF-09': 'JPY prices shown with fractional yen',
  'DEF-11': 'An unknown currency code is added to the supported-currency list for every shopper',
} as const;
