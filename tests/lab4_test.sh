#!/bin/bash
set -e

CHART_PATH="helm/ecommerce"

echo "--- Starting Lab 4 Grading (Helm Chart Check) ---"

# 1. Check that Chart.yaml exists
echo "Step 1: Checking Chart.yaml exists..."
if [ ! -f "$CHART_PATH/Chart.yaml" ]; then
  echo "❌ Error: $CHART_PATH/Chart.yaml not found."
  exit 1
fi
echo "  ✔ Chart.yaml found."

# 2. Check that values.yaml has required keys
echo "Step 2: Checking values.yaml for required keys..."
for KEY in replicaCount image resources; do
  if ! grep -q "^${KEY}:" "$CHART_PATH/values.yaml"; then
    echo "❌ Error: Required key '${KEY}' not found at top level of values.yaml."
    exit 1
  fi
  echo "  ✔ Key '${KEY}' present."
done

# 3. Check that values-prod.yaml exists
echo "Step 3: Checking values-prod.yaml exists..."
if [ ! -f "$CHART_PATH/values-prod.yaml" ]; then
  echo "❌ Error: $CHART_PATH/values-prod.yaml not found."
  exit 1
fi
echo "  ✔ values-prod.yaml found."

# 4. helm lint
echo "Step 4: Running helm lint..."
helm lint "$CHART_PATH"
echo "  ✔ helm lint passed."

# 5. helm template renders without error (default values)
echo "Step 5: Running helm template with default values..."
helm template ecommerce "$CHART_PATH" > /dev/null
echo "  ✔ helm template (default) succeeded."

# 6. helm template with values-prod.yaml produces replicas: 3
echo "Step 6: Verifying values-prod.yaml sets replicaCount to 3..."
RENDERED=$(helm template ecommerce "$CHART_PATH" -f "$CHART_PATH/values-prod.yaml")
if ! echo "$RENDERED" | grep -q "replicas: 3"; then
  echo "❌ Error: 'replicas: 3' not found in rendered output with values-prod.yaml."
  exit 1
fi
echo "  ✔ Production values render with replicas: 3."

echo ""
echo "✅ SUCCESS: Lab 4 is passed!"
