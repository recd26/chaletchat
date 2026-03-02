import { Link } from 'react-router-dom'

export default function Conditions() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link to="/" className="text-xs text-coral font-600 hover:underline mb-4 inline-block">← Retour à l'accueil</Link>

      <h1 className="text-3xl font-800 text-gray-900 mb-2">Conditions d'utilisation</h1>
      <p className="text-sm text-gray-400 mb-8">Dernière mise à jour : 1er mars 2026</p>

      <div className="prose prose-sm text-gray-600 space-y-6">
        <section>
          <h2 className="text-lg font-700 text-gray-900">1. Acceptation des conditions</h2>
          <p>En utilisant la plateforme ChaletProp, vous acceptez les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">2. Description du service</h2>
          <p>ChaletProp est une plateforme de mise en relation entre propriétaires de chalets locatifs et professionnel·le·s du ménage. Nous facilitons la réservation, le suivi (checklist avec photos) et le paiement des services de nettoyage.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">3. Inscription et comptes</h2>
          <p>Vous devez fournir des informations exactes lors de votre inscription. Les professionnel·le·s doivent se soumettre à une vérification d'identité. Vous êtes responsable de la confidentialité de vos identifiants de connexion.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">4. Obligations des propriétaires</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fournir des informations exactes sur le chalet (adresse, accès, nombre de pièces)</li>
            <li>Enregistrer un moyen de paiement valide avant toute demande</li>
            <li>Respecter le tarif convenu avec le professionnel</li>
            <li>Fournir un accès sécuritaire au chalet</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">5. Obligations des professionnel·le·s</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Compléter la vérification d'identité</li>
            <li>Respecter la checklist et prendre une photo par pièce</li>
            <li>Effectuer le ménage selon les standards de qualité</li>
            <li>Respecter les horaires convenus</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">6. Paiements et frais</h2>
          <p>ChaletProp prélève des frais de service de 3% sur chaque transaction. Les paiements sont libérés automatiquement après la complétion de la checklist avec photos. Les professionnels reçoivent le paiement dans les 2 heures suivant la complétion.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">7. Annulation</h2>
          <p>Les demandes peuvent être annulées sans frais jusqu'à 24h avant la date prévue. Après ce délai, des frais d'annulation peuvent s'appliquer selon la politique en vigueur.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">8. Limitation de responsabilité</h2>
          <p>ChaletProp agit en tant qu'intermédiaire. Nous ne sommes pas responsables de la qualité du ménage ni des dommages survenus dans les propriétés. Les propriétaires et professionnel·le·s sont des utilisateurs indépendants.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">9. Modification des conditions</h2>
          <p>Nous nous réservons le droit de modifier ces conditions. Les utilisateurs seront notifiés de tout changement majeur par courriel.</p>
        </section>

        <section>
          <h2 className="text-lg font-700 text-gray-900">10. Contact</h2>
          <p>Pour toute question concernant ces conditions, contactez-nous à : <strong>support@chaletprop.com</strong></p>
        </section>
      </div>
    </div>
  )
}
