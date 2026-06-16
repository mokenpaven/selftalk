import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

export function useIconFonts() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Font.loadAsync({
      // Load any custom fonts here if needed
    })
      .then(() => setLoaded(true))
      .catch((err) => {
        console.error('Error loading fonts:', err);
        setError(err);
      });
  }, []);

  return [loaded, error] as const;
}