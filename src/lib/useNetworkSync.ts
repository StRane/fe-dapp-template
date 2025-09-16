import { useEffect } from 'react';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { useNetworkStore } from '@/store/networkStore';

/**
 * Centralized network synchronization hook
 * This should only be used ONCE in your app (preferably in the root component)
 * to avoid duplicate network sync calls
 */
export const useNetworkSync = () => {
    const { isConnected } = useAppKitAccount();
    const { caipNetwork } = useAppKitNetwork();
    const { syncNetworkFromAppKit } = useNetworkStore();

    console.log('[useNetworkSync] === HOOK CALL ===');

    // Centralized network sync - only place in app that calls syncNetworkFromAppKit
    useEffect(() => {
        console.log('[useNetworkSync] === NETWORK SYNC EFFECT START ===');
        console.log('[useNetworkSync] Network sync inputs:', {
            isConnected,
            networkName: caipNetwork?.name,
            networkId: caipNetwork?.id
        });

        // Sync when connected and we have network info
        if (isConnected && (caipNetwork?.name || caipNetwork?.id)) {
            console.log('[useNetworkSync] Triggering centralized network sync from AppKit');
            syncNetworkFromAppKit(
                caipNetwork?.name || null,
                caipNetwork?.id?.toString() || null
            );
        }
        console.log('[useNetworkSync] === NETWORK SYNC EFFECT END ===');
    }, [isConnected, caipNetwork?.name, caipNetwork?.id, syncNetworkFromAppKit]);

    console.log('[useNetworkSync] === HOOK CALL END ===');
};