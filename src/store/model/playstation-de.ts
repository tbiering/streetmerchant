import {Store} from './store';
import fetch from 'node-fetch';

export const PlayStationDe: Store = {
  currency: '€',
  labels: {
    inStock: [
      {
        container: '.productHero-desc .add-to-cart:not(.hide)',
        text: ['In den Einkaufswagen'],
      },
      {
        container: '.bulleted-info.queue',
        text: ['queue'],
      },
    ],
    outOfStock: {
      container: '.productHero-info .out-stock-wrpr:not(.hide)',
      text: ['Nicht lieferbar'],
    },
  },
  links: [
    {
      brand: 'test:brand',
      itemNumber: '9399506-DE',
      model: 'test:model',
      series: 'test:series',
      url: 'https://direct.playstation.com/de-de/buy-accessories/dualsense-wireless-controller',
    },
    {
      brand: 'sony',
      itemNumber: '9709091-DE',
      model: 'ps5 console',
      series: 'sonyps5c',
      url: 'https://direct.playstation.com/de-de/buy-consoles/playstation5-console',
    },
    {
      brand: 'sony',
      itemNumber: '9710196-DE',
      model: 'ps5 digital',
      series: 'sonyps5de',
      url: 'https://direct.playstation.com/de-de/buy-consoles/playstation5-digital-edition-console',
    },
  ],
  name: 'playstation-de',
  realTimeInventoryLookup: async (itemNumber: string) => {
    const request_url =
      'https://api.direct.playstation.com/commercewebservices/ps-direct-de/products/productList?fields=BASIC&productCodes=' +
      itemNumber;
    const response = await fetch(request_url);
    const response_json = await response.json();
    if (
      response_json.products[0].stock.stockLevelStatus !== 'outOfStock' &&
      response_json.products[0].maxOrderQuantity >= 0
    ) {
      return true;
    }

    return false;
  },
};
