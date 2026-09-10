import { getErrorMessage, logMessage, } from './helpers';
export class StreamingDataProvider {
    constructor(wsUrl) {
        this._subscribers = {};
        this._ws = new WebSocket(wsUrl);
        this._ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this._onWebSocketMessage(data);
        };
        this._ws.onopen = () => logMessage("WebSocket connection established");
        this._ws.onerror = (error) => logMessage(`WebSocket error: ${getErrorMessage(error)}`);
        this._ws.onclose = () => logMessage("WebSocket connection closed");
    }
    subscribeBars(symbolInfo, resolution, newDataCallback, listenerGuid) {
        var _a;
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
        this._ws.send(((_a = symbolInfo.ticker) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || '');
        logMessage(`StreamingDataProvider: subscribed for #${listenerGuid} - {${symbolInfo.name}, ${resolution}}`);
    }
    unsubscribeBars(listenerGuid) {
        delete this._subscribers[listenerGuid];
        logMessage(`StreamingDataProvider: unsubscribed for #${listenerGuid}`);
    }
    _onWebSocketMessage(data) {
        for (const listenerGuid in this._subscribers) {
            const subscriptionRecord = this._subscribers[listenerGuid];
            if (subscriptionRecord.symbolInfo.ticker === data.S) {
                this._onSubscriberDataReceived(subscriptionRecord, data);
            }
        }
    }
    _onSubscriberDataReceived(subscriptionRecord, data) {
        const timestampInMs = data.T * 1000; // Convert to milliseconds
        // Get subscribed resolution
        const resolution = subscriptionRecord.resolution;
        const isIntraday = /^\d$/.test(resolution.slice(-1));
        if (isIntraday) {
            const latestBar = {
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
            const latestBar = {
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
