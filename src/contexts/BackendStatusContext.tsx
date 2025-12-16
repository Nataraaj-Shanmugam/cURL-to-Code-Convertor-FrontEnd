// src/contexts/BackendStatusContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type BackendStatus = 'checking' | 'ready' | 'warning' | 'down';

interface BackendStatusContextType {
  backendStatus: BackendStatus;
  downtime: number;
  isBackendDown: boolean;
}

const BackendStatusContext = createContext<BackendStatusContextType | undefined>(undefined);

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [downtime, setDowntime] = useState(0);

  useEffect(() => {
    let downtimeTimer: number;
    let healthCheckInterval: number;

    const checkBackendHealth = async () => {
      try {
        const healthUrl = `${import.meta.env.VITE_CURL_CRAFT_API_URL}${import.meta.env.VITE_CURL_CRAFT_API_HEALTH_ENDPOINT || '/health'}`;
        const response = await fetch(healthUrl, {
          method: 'GET',
        });
        
        if (response.ok) {
          setBackendStatus('ready');
          setDowntime(0);
          if (downtimeTimer) clearInterval(downtimeTimer);
        } else {
          throw new Error('Backend unhealthy');
        }
      } catch (error) {
        console.log('Backend is warming up...');
        
        // Start tracking downtime if not already tracking
        if (backendStatus === 'checking' || backendStatus === 'ready') {
          setBackendStatus('warning');
          setDowntime(0);
          
          // Start downtime counter
          downtimeTimer = window.setInterval(() => {
            setDowntime(prev => {
              const newDowntime = prev + 1;
              // Switch to 'down' status after 10 minutes (600 seconds)
              if (newDowntime >= (import.meta.env.VITE_BE_DOWNTIME*60)) {
                setBackendStatus('down');
              }
              return newDowntime;
            });
          }, 1000);
        }
      }
    };

    // Initial check
    checkBackendHealth();

    // Check every 30 seconds
    healthCheckInterval = window.setInterval(checkBackendHealth, 30000);

    return () => {
      if (downtimeTimer) clearInterval(downtimeTimer);
      if (healthCheckInterval) clearInterval(healthCheckInterval);
    };
  }, [backendStatus]);

  return (
    <BackendStatusContext.Provider 
      value={{ 
        backendStatus, 
        downtime,
        isBackendDown: backendStatus === 'down'
      }}
    >
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  const context = useContext(BackendStatusContext);
  if (context === undefined) {
    throw new Error('useBackendStatus must be used within a BackendStatusProvider');
  }
  return context;
}