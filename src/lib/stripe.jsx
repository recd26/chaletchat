import { loadStripe } from '@stripe/stripe-js'

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

if (!key) {
  console.warn('⚠️  Clé Stripe manquante. Ajoutez VITE_STRIPE_PUBLISHABLE_KEY dans votre .env.')
}

// Singleton Stripe promise — ne jamais créer à l'intérieur d'un composant
export const stripePromise = loadStripe(key || 'pk_test_placeholder')
