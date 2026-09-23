(function () {
    'use strict';

    let plugin = null;
    let lastStatus = null;

    function capacitor() {
        return window.Capacitor || null;
    }

    function isNativeIOS() {
        const cap = capacitor();
        if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return false;
        if (typeof cap.getPlatform === 'function') return cap.getPlatform() === 'ios';
        return cap.platform === 'ios';
    }

    function getPlugin() {
        if (!isNativeIOS()) return null;
        const cap = capacitor();
        if (!cap || typeof cap.registerPlugin !== 'function') return null;
        if (!plugin) plugin = cap.registerPlugin('HarmonyNativeAudio');
        return plugin;
    }

    async function call(method, payload) {
        const p = getPlugin();
        if (!p || typeof p[method] !== 'function') {
            throw new Error('HarmonyNativeAudio native plugin unavailable');
        }
        const result = await p[method](payload || {});
        if (result && Object.prototype.hasOwnProperty.call(result, 'engineRunning')) {
            lastStatus = result;
        }
        return result;
    }

    window.NativeAudioBridge = {
        isAvailable() {
            return !!getPlugin();
        },

        isNativeIOS,

        async initialize() {
            return call('initialize');
        },

        async activate() {
            return call('activate');
        },

        async playVoices(voices) {
            return call('playVoices', { voices });
        },

        async stopAll() {
            return call('stopAll');
        },

        async deactivate() {
            return call('deactivate');
        },

        async status() {
            return call('status');
        },

        getLastStatus() {
            return lastStatus;
        }
    };
})();
