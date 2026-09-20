import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { SUBSCRIPTION_TIERS, SubscriptionTier } from '@/lib/subscription-tiers';

interface SubscriptionContextType {
  subscribed: boolean;
  billingEnabled: boolean;
  tier: SubscriptionTier;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  upgradeUrl: (priceId: string) => Promise<string | null>;
  manageSubscription: () => Promise<string | null>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);


export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [subscribed, setSubscribed] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [productId, setProductId] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const requestGeneration = useRef(0);

  const checkSubscription = async () => {
    const generation = ++requestGeneration.current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setBillingEnabled(false);
        setSubscribed(false);
        setTier('free');
        setProductId(null);
        setSubscriptionEnd(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (generation !== requestGeneration.current) return;
      if (error || !data) {
        console.error('Error checking subscription:', error);
        setBillingEnabled(false);
        setSubscribed(false);
        setTier('free');
        setProductId(null);
        setSubscriptionEnd(null);
        return;
      }

      setBillingEnabled(data.billing_enabled === true);
      setSubscribed(data.subscribed || false);
      setTier(data.tier in SUBSCRIPTION_TIERS ? data.tier : 'free');
      setProductId(data.product_id || null);
      setSubscriptionEnd(data.subscription_end || null);
      console.log('Subscription loaded from Stripe:', data.tier);
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      console.error('Error in checkSubscription:', error);
      setBillingEnabled(false);
      setSubscribed(false);
      setTier('free');
      setProductId(null);
      setSubscriptionEnd(null);
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };

  const upgradeUrl = async (priceId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId }
      });
      
      if (error || !data?.url) {
        console.error('Error creating checkout:', error);
        return null;
      }
      
      return data.url;
    } catch (error) {
      console.error('Error getting upgrade URL:', error);
      return null;
    }
  };

  const manageSubscription = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error || !data?.url) {
        console.error('Error creating portal session:', error);
        return null;
      }
      
      return data.url;
    } catch (error) {
      console.error('Error getting portal URL:', error);
      return null;
    }
  };

  useEffect(() => {
    // Check subscription on mount
    checkSubscription();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => { void checkSubscription(); }, 0);
      } else if (event === 'SIGNED_OUT') {
        requestGeneration.current++;
        setLoading(false);
        setBillingEnabled(false);
        setSubscribed(false);
        setTier('free');
        setProductId(null);
        setSubscriptionEnd(null);
      }
    });

    // Refresh subscription status every minute
    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        subscribed,
        billingEnabled,
        tier,
        productId,
        subscriptionEnd,
        loading,
        checkSubscription,
        upgradeUrl,
        manageSubscription
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

