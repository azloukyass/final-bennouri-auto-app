export default function ConditionsGeneralesVente() {
  return (
    <div className="bg-white text-slate-800" data-testid="cgv-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <h1 className="font-display text-3xl md:text-4xl font-black text-blue-900 mb-2">
          Conditions générales de vente
        </h1>
        <p className="text-sm text-slate-500 mb-10">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

        <div className="space-y-10 leading-relaxed text-slate-700">

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">Article 1 — Objet</h2>
            <p>
              Les présentes conditions générales de vente (ci-après « CGV ») régissent les relations
              commerciales entre Bennouri.tn (ci-après le « Site »), exploité par la société{" "}
              <strong>[Raison sociale de BENNOURI]</strong>, dont le siège social est situé à{" "}
              <strong>Blanche Morneg N°53, La Nouvelle Medina, Ben Arous 2063</strong>, ayant pour matricule
              fiscal <strong>[Matricule fiscal]</strong>, inscrite au registre de commerce sous le n°{" "}
              <strong>[N° RC]</strong>, et toute personne physique ou morale (ci-après « Client ») souhaitant
              effectuer un achat via le Site.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">
              Article 2 — Champ d'application des CGV — Acceptation et modifications
            </h2>
            <p>
              Tout achat d'un produit sur le Site implique une acceptation expresse et sans réserve par le
              Client des CGV et de la politique de confidentialité, dont le Client reconnaît avoir pris
              connaissance, en cochant la case prévue à cet effet lors de la création de son compte et de la
              validation de sa commande.
            </p>
            <p className="mt-3">
              Bennouri se réserve la possibilité de modifier ses CGV, à tout moment, afin notamment de faire
              évoluer ses services ou de se conformer à toute nouvelle réglementation applicable. Les CGV
              applicables seront celles en vigueur à la date de la commande par le Client.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">Article 3 — Création de compte client</h2>
            <p>Avant toute commande, le Client doit créer un compte sur le Site.</p>
            <p className="mt-3">
              Les informations nécessaires à la création du compte sont : une adresse e-mail valide et un mot
              de passe. Lors de la première commande, d'autres informations seront demandées au Client : nom,
              prénom, numéro de téléphone, adresse de facturation et de livraison.
            </p>
            <p className="mt-3">
              Vous déclarez et garantissez que toutes les informations fournies dans le formulaire
              d'inscription sont complètes et exactes.
            </p>
            <p className="mt-3">
              Le Client est tenu de préserver la confidentialité de ses identifiants. En cas de perte,
              d'oubli ou d'utilisation détournée de ses identifiants par un tiers, le Client doit
              immédiatement en informer Bennouri en contactant le service client.
            </p>
            <p className="mt-3">
              Vous pouvez, à tout moment, vous désinscrire et supprimer votre compte en contactant le service
              client.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">Article 4 — Commande</h2>
            <p>
              Pour effectuer un achat, le Client doit passer sa commande directement sur le Site. Le Client
              sélectionne le(s) produit(s) correspondant à sa recherche et le(s) ajoute à son panier. Après
              s'être authentifié, le Client pourra alors valider sa commande.
            </p>
            <p className="mt-3">
              La recherche s'effectue soit après sélection du véhicule (par plaque d'immatriculation ou
              identification simple), soit en saisissant directement dans la barre de recherche la référence
              de la pièce ou celle d'origine.
            </p>
            <p className="mt-3">
              Le Client a la possibilité d'annuler la commande avant la livraison, en allant directement dans
              son espace client sous la rubrique « Mes commandes ».
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">Article 5 — Produits</h2>
            <p>
              Tous les produits proposés à la vente sur le Site sont des produits neufs. Bennouri s'engage à
              honorer les commandes dans la limite des stocks disponibles chez ses fournisseurs. En cas de
              non-disponibilité du produit commandé ou en cas d'augmentation significative du délai de
              livraison, Bennouri proposera au Client un produit de remplacement.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">Article 6 — Prix</h2>
            <p>
              Le prix des produits figurant sur le Site est exprimé en Dinar tunisien, toutes taxes comprises,
              et tient compte de la TVA applicable au jour de la commande. Tout changement du taux applicable
              sera répercuté sur les prix des produits. Bennouri se réserve le droit de modifier ses prix à
              tout moment, mais le Client sera facturé du montant en vigueur au moment de la validation de la
              commande.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">Article 7 — Paiement</h2>
            <p>
              Le Client reconnaît avoir la capacité juridique et l'autorisation nécessaire pour l'utilisation
              du moyen de paiement.
            </p>
            <p className="mt-3">Le paiement peut se faire par chèque ou en espèces à la livraison.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">Article 8 — Livraison</h2>
            <p>
              Les produits achetés sur Bennouri seront livrés à l'adresse spécifiée lors de la commande.
            </p>
            <p className="mt-3">
              La livraison sera effectuée soit par notre société, soit par nos partenaires sous-traitants.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">Article 9 — Retour des produits</h2>
            <p>
              Le Client a la possibilité de retourner un ou plusieurs produits commandés sur le Site dans un
              délai de cinq (5) jours à compter de la date de réception.
            </p>
            <p className="mt-3">
              La demande de retour se fait en prenant contact directement avec le service client par WhatsApp
              ou par téléphone au{" "}
              <a href="tel:+21650881000" className="text-blue-700 hover:underline">+216 50 881 000</a>{" "}
              ou au{" "}
              <a href="tel:+21654643643" className="text-blue-700 hover:underline">+216 54 643 643</a>.
            </p>
            <p className="mt-3">
              Afin d'être accepté, tout produit retourné doit être en parfait état, sans aucune trace d'usure
              ou de montage. Son emballage doit aussi être dans son état d'origine, sans traces de déchirures.
            </p>
            <p className="mt-3">
              Les pièces électriques ne peuvent être ni échangées ni retournées (capteur d'arbre à cames,
              capteur de vilebrequin, débitmètre, sonde lambda...).
            </p>
            <p className="mt-3">
              Si le motif de retour est dû à une erreur d'envoi ou de référence commise par Bennouri, les
              frais de retour seront à notre charge. Dans le cas contraire, ils seront à la charge du Client.
            </p>
            <p className="mt-3">
              Après acceptation du retour, le Client recevera un avoir de la valeur des articles retournés.
              Cet avoir peut être utilisé sans limite dans le temps pour acheter d'autres articles.
            </p>
            <p className="mt-3">
              Dans le cas où le véhicule est modifié (moteur changé ou autre préparation non conforme à
              l'origine), Bennouri n'assume aucune responsabilité et aucun retour n'est accepté.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-blue-900 mb-3">
              Loi applicable et compétence juridictionnelle
            </h2>
            <p>
              Le présent contrat, son interprétation et son exécution sont régis par le droit tunisien.
            </p>
            <p className="mt-3">
              En cas de litige, et à défaut d'une solution à l'amiable, les tribunaux de Tunis seront seuls
              compétents pour statuer sur tout litige pouvant porter sur la validité, l'interprétation et
              l'application des présentes conditions générales de vente.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
