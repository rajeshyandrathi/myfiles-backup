public class CD_CaseDisputeAutomation_Service {
    
    private static Capitec_Endpoint__mdt endpointMdt = [SELECT Id, URL__c, DeveloperName FROM Capitec_Endpoint__mdt WHERE DeveloperName = 'CD_Dispute_Automation_Case' LIMIT 1];
    private static final String NAMED_CRED = 'callout:NC_ClientDomain';
    private static final Integer MAX_TIMEOUT_VAL = 120000;

    @AuraEnabled
    public static CD_CaseDisputeAutomation_ResponseWrapper createNewRecords(List<Automation_Finding_Evidence__c> selectedEvidences, String caseId) {
        Set<String> eIds = new Set<String>();
        for (Automation_Finding_Evidence__c evi : selectedEvidences) {
            eIds.add(evi.POE_Id__c);
        }
        
        List<Automation_Finding_Evidence__c> existingEvidences = [SELECT Id, POE_Id__c FROM Automation_Finding_Evidence__c WHERE POE_Id__c IN :eIds AND Case__c = :caseId];
        Map<String, Automation_Finding_Evidence__c> evidenceMap = new Map<String, Automation_Finding_Evidence__c>();
        
        for (Automation_Finding_Evidence__c cEvi : existingEvidences) {
            evidenceMap.put(cEvi.POE_Id__c, cEvi);
        }        

        List<Automation_Finding_Evidence__c> prepEvidences = new List<Automation_Finding_Evidence__c>();
        for (Automation_Finding_Evidence__c evi : selectedEvidences) {
            if (evidenceMap.get(evi.POE_Id__c) == null) {
                prepEvidences.add(evi);
            }
        }
        
        CD_CaseDisputeAutomation_ResponseWrapper wrapper = new CD_CaseDisputeAutomation_ResponseWrapper();
        
        try {
            if (!prepEvidences.isEmpty()) {
                insert prepEvidences;
            }
        } catch (Exception e) {
            wrapper.outcome = 'error';
            wrapper.message = e.getMessage();
            return wrapper;
        }
        
        if (selectedEvidences.size() == 0) {
            wrapper.outcome = 'warning';
            wrapper.message = 'No evidence is selected. Please select at least one evidence to flag';
        } else if (prepEvidences.size() == 0 && existingEvidences.size() == selectedEvidences.size()) {
            wrapper.outcome = 'warning';
            wrapper.message = 'All selected evidences were already flagged to this Case. Please review in General Related List Tab';
        } else if (prepEvidences.size() > 0 && existingEvidences.size() > 0) {
            wrapper.outcome = 'success';
            wrapper.message = prepEvidences.size() + ' evidences are flagged successfully and ' + existingEvidences.size() + ' were already flagged to this Case';
        } else if (prepEvidences.size() == selectedEvidences.size()) {
            wrapper.outcome = 'success';
            wrapper.message = prepEvidences.size() + ' evidences are flagged successfully to this Case';
        }
        system.debug('wrapper: '+wrapper);
        return wrapper;
    }
        
    @AuraEnabled(cacheable=false)
    public static CD_CaseDisputeAutomation_ResponseWrapper getAutomationFindings(String caseId, String caseNumber) {
        if (String.isBlank(caseNumber)) {
            caseNumber = [SELECT Id, CaseNumber FROM Case WHERE Id = :caseId].CaseNumber;
        }
        HttpResponse response = makeCallout(caseNumber);
        CD_CaseDisputeAutomation_ResponseWrapper responseWrapper = handleResponse(response);
        
        if (response.getStatusCode() == 200) {
            Cash_Control__c ccontrol = getCashControl(caseId);
            saveAutomationSummary(ccontrol.Id, ccontrol.Automation_Finding_Summary__c, response.getBody());
        }
        
        return responseWrapper;
    }
    
    public static CD_CaseDisputeAutomation_ResponseWrapper handleResponse(HttpResponse response) {
        CD_CaseDisputeAutomation_ResponseWrapper wrapper = new CD_CaseDisputeAutomation_ResponseWrapper();
        if (response.getStatusCode() == 200) {
            wrapper.outcome = 'success';
            wrapper.finding = (CD_CaseDisputeAutomation_ResponseWrapper.Finding) JSON.deserialize(response.getBody(), CD_CaseDisputeAutomation_ResponseWrapper.Finding.class);
        } else {
            wrapper.outcome = 'error';
            wrapper.message = response.getBody();
        }
        
        return wrapper;
    }
    
    public static HttpResponse makeCallout(String caseNumber) {
        Http http = new Http();
        HttpRequest request = new HttpRequest();
        HttpResponse response = new HttpResponse();
        try {
            request.setMethod('GET');
            request.setEndpoint(NAMED_CRED + endpointMdt.URL__c + caseNumber);
            request.setTimeout(MAX_TIMEOUT_VAL);
            response = http.send(request);
        } catch (Exception e) {
            response.setStatusCode(500);
            response.setBody(e.getMessage());
        }
        
        return response;
    }	
    
    public static Cash_Control__c getCashControl(String caseId) {
        return [SELECT Id, Automation_Finding_Summary__c FROM Cash_Control__c WHERE Case__c = :caseId LIMIT 1];
    }
    
    public static void saveAutomationSummary(String ccontrolId, String ccontrolAutoSummary, String rawJson) {
        if (String.isBlank(ccontrolId) || String.isBlank(rawJson)) {
            return;
        }
        String automationSummary = getAutomationSummary(rawJson);
        if (String.isNotBlank(automationSummary) && !automationSummary.equals(ccontrolAutoSummary)) {
            Cash_Control__c ccontrol = new Cash_Control__c(Id = ccontrolId);
            ccontrol.Automation_Finding_Summary__c = automationSummary;
            update ccontrol;
        }
    }
    
    public static String getAutomationSummary(String rawJson) {
        if (String.isBlank(rawJson)) {
            return '';
        }
        
        Map<String, Object> payload = (Map<String, Object>) JSON.deserializeUntyped(rawJson);
        return payload.containsKey('automationSummary') ? JSON.serialize(payload.get('automationSummary')) : '';
    }
    
}