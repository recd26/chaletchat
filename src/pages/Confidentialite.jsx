import { Link } from 'react-router-dom'

export default function Confidentialite() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link to="/" className="text-xs text-coral font-600 hover:underline mb-4 inline-block">← Retour à l'accueil</Link>

      <h1 className="text-3xl font-800 text-gray-900 mb-2">Politique de confidentialité</h1>
      <p className="text-sm text-gray-400 mb-8">Dernière mise à jour : 1er mars 2026</p>

      <div className="prose prose-sm text-gray-600 space-y-6">
        <section>
          <h2 className="text-lg font-700 text-gray-900">1. Collecte des données</h2>
          <p>Nous collectons les informations suivantes lors de votre inscription et utilisation de ChaletProp :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Données d'identité :</strong> nom, prénom, adresse courriel, numéro de téléphone</li>
            <li><strong>Données de localisation :</strong> adresse, ville, province, code postal, coordonnées GPS</li>
            <li><strong>Documents de vérification :</strong> selfie et pièce d'identité (professionnel·le·s uniquement)</li>
            <li><strong>Données financières :</strong> informations bancaires (professionnel·le·s), méthode de paiement (propriétaires)</li>
            <li><strong>Photos de ménage :</strong> photos prises lors de la complétion des checklists</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">2. Utilisation des données</h2>
          <p>Vos données sont utilisées pour :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fournir et améliorer nos services de mise en relation</li>
            <li>Vérifier l'identité des professionnel·le·s</li>
            <li>Traiter les paiements</li>
            <li>Envoyer des notifications relatives aux demandes et missions</li>
            <li>Permettre la géolocalisation pour les demandes à proximité</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">3. Stockage et sécurité</h2>
          <p>Vos données sont stockées sur les serveurs sécurisés de Supabase (hébergés par AWS). Les documents d'identité sont chiffrés (AES-256) et ne sont jamais partagés avec les propriétaires. Seule l'équipe de vérification y a accès.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">4. Partage des données</h2>
          <p>Nous ne vendons jamais vos données. Les informations partagées entre utilisateurs se limitent à :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Propriétaires :</strong> voient le prénom, nom, ville, expérience et évaluations du professionnel</li>
            <li><strong>Professionnel·le·s :</strong> reçoivent les détails d'accès du chalet uniquement après acceptation</li>
            <li><strong>Photos de ménage :</strong> visibles par le propriétaire et le professionnel de la mission</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">5. Vos droits</h2>
          <p>Conformément aux lois applicables, vous avez le droit de :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Accéder à vos données personnelles</li>
            <li>Rectifier vos informations</li>
            <li>Demander la suppression de votre compte et de vos données</li>
            <li>Exporter vos données dans un format lisible</li>
            <li>Retirer votre consentement à tout moment</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">6. Cookies</h2>
          <p>ChaletProp utilise des cookies essentiels pour le fonctionnement de l'application (authentification, session). Nous n'utilisons pas de cookies publicitaires ni de traceurs tiers.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">7. Conservation des données</h2>
          <p>Vos données sont conservées tant que votre compte est actif. Après suppression du compte, les données sont effacées dans un délai de 30 jours, à l'exception des données requises par la loi (transactions financières).</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">8. Contact</h2>
          <p>Pour toute question concernant vos données personnelles : <strong>privacy@chaletprop.com</strong></p>
        </section>
      </div>
    </div>
  )
}
