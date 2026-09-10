import { UDFCompatibleDatafeedBase } from './udf-compatible-datafeed-base';
import { QuotesProvider } from './quotes-provider';
import { Requester } from './requester';
export class UDFCompatibleDatafeed extends UDFCompatibleDatafeedBase {
    constructor(datafeedURL, updateFrequency = 10 * 1000, streamingURL, limitedServerResponse) {
        const requester = new Requester();
        const quotesProvider = new QuotesProvider(datafeedURL, requester);
        super(datafeedURL, streamingURL, quotesProvider, requester, updateFrequency, limitedServerResponse);
    }
}
