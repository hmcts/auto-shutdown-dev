#!/usr/bin/env bash
# set -x
shopt -s nocasematch

# Source shared function scripts
source scripts/vm/common-functions.sh
source scripts/common/common-functions.sh

# Set variables for later use, MODE has a default but can be overridden at usage time
# notificationSlackWebhook is used during the function call `auto_shutdown_notification`
MODE=${1:-start}
notificationSlackWebhook=$2
SKIP="false"

# Catch problems with MODE input, must be one of start/deallocate
if [[ "$MODE" != "start" && "$MODE" != "deallocate" ]]; then
	echo "Invalid MODE. Please use 'start' or 'deallocate'."
	exit 1
fi

VMS=$(get_vms)

# For each VM found in the function `get_vms` start another loop
jq -c '.data[]' <<<$VMS | while read vm; do

    # Function that returns the Resource Group, Id and Name of the VMs and its current state as variables
    get_vm_details

    log "====================================================="
    log "Processing Virtual Machine: $VM_NAME in Resource Group: $RESOURCE_GROUP"
    log "====================================================="

    # Map the environment name to match Azure enviornment tag
    case "$ENVIRONMENT" in
    "development")
        VM_ENV="Preview / Dev"
        ;;
    "test")
        VM_ENV="Test / Perftest"
        ;;
    "testing")
        VM_ENV="Test / Perftest"
        ;;
    *)
        VM_ENV=$(to_lowercase "$SELECTED_ENV")
        ;;
    esac

        # SKIP variable updated based on the output of the `should_skip_start_stop` function which calculates its value based
        # on a tag named `startupMode` and the `issues_list.json` file which contains user requests to keep environments online after normal hours
        SKIP=$(should_skip_start_stop $VM_ENV $BUSINESS_AREA $MODE)

        # Setup message output templates for later use
		logMessage="VM: $VM_NAME in ResourceGroup: $RESOURCE_GROUP is $VM_STATE state after $MODE action."
		slackMessage="VM: *$VM_NAME* in Subscription: *$SUBSCRIPTION*  ResourceGroup: *$RESOURCE_GROUP* is *$VM_STATE* state after *$MODE* action."

        # If SKIP is false then we progress with the status chec for the particular VM in this loop run, if SKIP is true then do nothing
        if [[ $SKIP == "false" ]]; then
		# Check state of the VM and print output as required
		# Depending on the value of MODE a notification will also be sent
		#    - If MODE = start then a stopped VM is incorrect and we should notify
		#    - If MODE = deallocate then a running VM is incorrect and we should notify
		#    - If neither Running or Stopped is found then something else is going on and we should notify
            case "$VM_STATE" in
                *"running"*)
                    ts_echo_color $( [[ $MODE == "start" ]] && echo GREEN || echo RED ) "$logMessage"
                    if [[ $MODE == "deallocate" ]]; then
                        auto_shutdown_notification ":red_circle: $slackMessage"
                    fi
                    ;;
                *"deallocated"*)
                    ts_echo_color $( [[ $MODE == "start" ]] && echo RED || echo GREEN ) "$logMessage"
                    if [[ $MODE == "start" ]]; then
                        auto_shutdown_notification ":red_circle: $slackMessage"
                    fi
                    ;;
                *)
                    ts_echo_color AMBER "$logMessage"
                    auto_shutdown_notification ":yellow_circle: $slackMessage"
                    ;;
            esac
        else
            ts_echo_color AMBER "VM: $VM_NAME in Resource Group: $RESOURCE_GROUP has been skipped from today's $MODE operation schedule"
        fi

	done
done
