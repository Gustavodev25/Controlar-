import React, { useEffect, useState, useRef } from 'react';
import * as dbService from '../services/database';

declare global {
    interface Window {
        fbq: any;
        _fbq: any;
    }
}

interface MetaPixelLoaderProps {
    activeTab?: string;
}

export const MetaPixelLoader: React.FC<MetaPixelLoaderProps> = ({ activeTab }) => {
    const [pixelId, setPixelId] = useState<string | null>(null);
    const prevTab = useRef(activeTab);

    useEffect(() => {
        const loadPixel = async () => {
            try {
                const settings = await dbService.getSystemSettings();
                if (settings.metaPixelId) {
                    setPixelId(settings.metaPixelId);
                }
            } catch (error) {
                console.error("Error loading Meta Pixel settings:", error);
            }
        };
        loadPixel();
    }, []);

    useEffect(() => {
        if (!pixelId) return;

        // Avoid double injection
        if (document.getElementById('meta-pixel-script')) return;

        const script = document.createElement('script');
        script.id = 'meta-pixel-script';
        // Initialize Pixel and track initial PageView
        script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `;
        document.head.appendChild(script);

        const noscript = document.createElement('noscript');
        noscript.id = 'meta-pixel-noscript';
        noscript.innerHTML = `<img height="1" width="1" style="display:none"
      src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
      />`;
        document.body.appendChild(noscript);
    }, [pixelId]);

    // Track PageView only when activeTab changes (navigation)
    useEffect(() => {
        if (!pixelId) return;

        // Only track if activeTab has changed from the previous value
        if (activeTab !== prevTab.current) {
            if (window.fbq) {
                window.fbq('track', 'PageView');
            }
            prevTab.current = activeTab;
        }
    }, [pixelId, activeTab]);

    return null;
};
