#!/usr/bin/env bash
source scripts/aks/common-functions.sh
source scripts/common/common-functions.sh

shopt -s nocasematch

MODE=${1:-start}

if [[ "$MODE" != "start" && "$MODE" != "stop" ]]; then
	echo "Invalid MODE. Please use 'start' or 'stop'."
	exit 1
fi

cluster_env=$SELECTED_ENV

if [[ $cluster_env == "AAT / Staging" ]]; then
	cluster_env="staging"
elif [[ $cluster_env == "Preview / Dev" ]]; then
	cluster_env="development"
elif [[ $cluster_env == "Test / Perftest" ]]; then
	cluster_env="testing"
elif [[ $cluster_env == "PTL" ]]; then
	cluster_env="production"
elif [[ $cluster_env == "PTLSBOX" ]]; then
	cluster_env="sandbox"
fi

cluster_area=$SELECTED_AREA

if [[ $cluster_area == "SDS" ]]; then
	cluster_area="Cross-Cutting"
fi

CLUSTERS=$(get_clusters $cluster_env $cluster_area)

jq -c '.data[]' <<<$CLUSTERS | while read cluster; do
	get_cluster_details

    if [[ $DEV_ENV != "true" ]]; then
      aks_state_messages
      az aks $MODE --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --subscription $SUBSCRIPTION --no-wait || echo Ignoring any errors while $MODE operation on cluster
    else
      ts_echo_color BLUE "Development Env: simulating state commands only."
      aks_state_messages
    fi

	RESULT=$(az aks show --name $CLUSTER_NAME -g $RESOURCE_GROUP --subscription $SUBSCRIPTION | jq -r .powerState.code)
	ts_echo "${RESULT}"
done
