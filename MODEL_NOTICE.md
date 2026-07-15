# Modèle alimentaire inclus

MacroFlow inclut le modèle **Google AIY Food V1** (`food-model.tflite`).

- Source du modèle : <https://tfhub.dev/google/aiy/vision/classifier/food_V1/1>
- Licence annoncée par la fiche officielle : Apache License 2.0
- Copie de la licence : `LICENSE-MODEL-APACHE-2.0.txt`

Le modèle a été entraîné sur un jeu de données orienté vers des aliments nord-américains. Ses résultats sont des probabilités à confirmer, pas une mesure nutritionnelle exacte.

## Scanner avancé

Le scanner avancé inclut aussi :

- `foodseg103.onnx`, modèle YOLOv8 entraîné sur FoodSeg103, publié sous licence Apache 2.0;
- `model_q4f16.onnx`, Depth Anything V2 Small converti pour ONNX Runtime Web, publié sous licence Apache 2.0;
- Transformers.js et ONNX Runtime Web, utilisés uniquement dans le navigateur.

Les modèles sont exécutés localement. Ils ne constituent pas une API et n'imposent ni compte, ni crédits, ni coût par scan. Ils restent des modèles probabilistes : une mauvaise lumière, une sauce, un aliment mélangé ou une recette inconnue peuvent produire une erreur.
