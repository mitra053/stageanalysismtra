import {
	getErrorMessage,
	logMessage,
} from './helpers';
import { IDataPulseProvider} from './provider-interfaces';
import { LibrarySymbolInfo, ResolutionString, SubscribeBarsCallback, Bar } from '../../../charting_library/datafeed-api';

interface DataSubscriber {
	symbolInfo: LibrarySymbolInfo;
	resolution: ResolutionString;
	lastBarTime: number | null;
	listener: SubscribeBarsCallback;
}

interface DataSubscribers {
	[guid: string]: DataSubscriber;
}

interface Data {
    S : string;
    O : number;
    H : number;
    L : number;
    C : number;
    V : number;
    LTV : number;
    T : number;
}

export class StreamingDataProvider implements IDataPulseProvider {
	private readonly _subscribers: DataSubscribers = {};
	private _ws: WebSocket;

	public constructor(wsUrl: string) {
		this._ws = new WebSocket(wsUrl);

		this._ws.onmessage = (event) => {
			const data : Data = JSON.parse(event.data);
			this._onWebSocketMessage(data);
		};

		this._ws.onopen = () => logMessage("WebSocket connection established");
		this._ws.onerror = (error: Event) => logMessage(`WebSocket error: ${getErrorMessage(error as unknown as Error)}`);
		this._ws.onclose = () => logMessage("WebSocket connection closed");
	}

	public subscribeBars(symbolInfo: LibrarySymbolInfo, resolution: ResolutionString, newDataCallback: SubscribeBarsCallback, listenerGuid: string): void {
		if (this._subscribers.hasOwnProperty(listenerGuid)) {
			logMessage(`StreamingDataProvider: already has subscriber with id=${listenerGuid}`);
			return;
		}

		this._subscribers[listenerGuid] = {
			lastBarTime: null,
			listener: newDataCallback,
			resolution: resolution,
			symbolInfo: symbolInfo,
		};

        // Send the symbol to the server
        this._ws.send(symbolInfo.ticker?.toUpperCase() || '');

		logMessage(`StreamingDataProvider: subscribed for #${listenerGuid} - {${symbolInfo.name}, ${resolution}}`);
	}

	public unsubscribeBars(listenerGuid: string): void {
		delete this._subscribers[listenerGuid];
		logMessage(`StreamingDataProvider: unsubscribed for #${listenerGuid}`);
	}

    private _onWebSocketMessage(data: Data) : void {
		for (const listenerGuid in this._subscribers) {
            const subscriptionRecord = this._subscribers[listenerGuid];
            if (subscriptionRecord.symbolInfo.ticker === data.S) {
                this._onSubscriberDataReceived(subscriptionRecord, data);
            }
        }
    }

	private _onSubscriberDataReceived(subscriptionRecord: DataSubscriber, data : Data) : void {
        const timestampInMs = data.T * 1000;  // Convert to milliseconds
        // Get subscribed resolution
        const resolution = subscriptionRecord.resolution;
        const isIntraday = /^\d$/.test(resolution.slice(-1));
        if (isIntraday) { 
            const latestBar: Bar = {
                time: timestampInMs,
                open: data.C,
                high: data.C,
                low: data.C,
                close: data.C,
                volume: data.LTV,
            };
            subscriptionRecord.lastBarTime = latestBar.time;
            subscriptionRecord.listener(latestBar);
        }
        else {
            const latestBar: Bar = {
                time: timestampInMs,
                open: data.O,
                high: data.H,
                low: data.L,
                close: data.C,
                volume: data.V,
            };
            // Update the subscriber with new data
            subscriptionRecord.lastBarTime = latestBar.time;
            subscriptionRecord.listener(latestBar);  
        }
    }
}
