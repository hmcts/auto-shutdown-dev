# aks-auto-shutdown
Config for Auto-Shutdown/Start of the AKS clusters

In the near future, all environments excluding Production will be automatically shutdown. This action is to reduce the unnecessary infrastructure costs while the environments are not in use.

## Default cluster shutdown hours

20:00 to 06:30 everyday of the week.

## Skip shutdown functionality

In the event that an environment or environments are needed outside of the default hours, you can raise an "issue" to automatically exclude it from the shutdown schedule.
- [Complete this issue form](https://github.com/hmcts/aks-auto-shutdown/issues/new?assignees=&labels=&projects=&template=skip-auto-shutdown-request.yaml).
- Multiple environments within the same "Business area" can be selected at the same time.
- "Cross-Cutting" = Shared Services
- Enter the "start date" for when automatic shutdown skips should begin.
- If available, enter an end date for when your desired enviornment nolonger needs to be skipped from the automatic shutdown schedule.
- If no end date is provided, it will default to the same day as the start date.
- Select "Submit new issue"
- Wait for form processing to complete (~5 seconds) - you will see feedback comments if there are errors or when processing is complete.
    - In the event you need to edit your issue due to an error (unexpected date format error).
    - You can select the three dots (...) followed by "Edit"
    - Make your change
    - Select "Update comment"
    - Processing checks will automatically restart.
- Issue will automatically close
- Review [shutdown exclusions json](https://github.com/hmcts/aks-auto-shutdown/blob/master/issues_list.json)

## Skip shutdown review process

All shutdown requests are now subject to an approval process, primarily based on the associated additional cost of running clusters for longer.

It is important to monitor the comment section of the request (GitHub issue), the automated process will provide feedback in these comments including:

- Associated cost of request in £
- Errors in form submission or cost processing
- Approval status

### Who can approve shutdown skip requests? 

Currently, anyone other than the request can be an approver. The main purpose of this approval system is to sanity check that requests are not excessive.

### What is the approval guidenance?

Requests should only be approved when the shutdown exclusion is necessary and for the appropriate amount of time.

You should check:
- Request has an appropriate Change or JIRA reference ID
- The start and end dates of the request are the minimum required, see below example.
- Only the necessary enviornments have been included in the request. Note: If you need AAT / Staging then you may want to also select PTL for Jenkins and Preview / Dev if you need to do a pull request

Examples:
- An exclusion is needed for an out of hours release on 20th March 2024.

In this example, the shutdown start date should be 20-03-2024 with an end date of 20-03-2024. Tip: Leaving the end date blank will default the end date to the same as the start date.

### How is approval added?

Request can be approved by adding the "approved" label to the request.

<img src="images/request-approved.png" alt="approval" height="150"/>


A request can be denied by adding the "denied" label to the request. This will automatically close the ticket.

