declare module "@binance/connector" {
  export class Spot {
    constructor(apiKey: string, apiSecret: string, options?: object);
    account(params?: object): Promise<any>;
    newOrder(
      symbol: string,
      side: string,
      type: string,
      params: object
    ): Promise<any>;
    logger: {
      log(message: any): void;
      error(message: any): void;
    };
  }

  export enum TimeUnit {
    MILLISECOND,
    MICROSECOND,
  }

  export interface WebsocketStream {
    ticker(symbol: string): void;
    disconnect(): void;
  }
}
