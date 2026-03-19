import { LightningElement, api, track } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import searchClientByField from '@salesforce/apex/capitec_ClientVerificationController.searchClientByField';

export default class ClientIdentification extends LightningElement {
    @api recordId;
    @api idType;
    @api idNumber;
    @api contentDocumentId = '';
    @api contentDocumentIds = '';
    @api contentDocumentNames = '';
    
    @track activeSections = ['idSection', 'bankSection']; 
    @track acceptedFormats = ['.pdf', '.png', '.jpg', '.jpeg'];
    @track errorMessage = '';
    @track uploadedFiles = [];
    @track clientInfo = {};
    @track hasClientInfo = false;
    @track isSearching = false;

    idTypeOptions = [
        { label: 'Identification Number', value: 'ID' },
        { label: 'Passport Number', value: 'PASSPORT' },
        { label: 'CIF Number', value: 'CIF' },
        { label: 'Account Number', value: 'ACCOUNT' }
    ];

    get filePills() {
        return (this.uploadedFiles || []).map(file => ({
            label: file.name,
            name: file.documentId,
            iconName: 'standard:file'
        }));
    }

    get hasUploadedFiles() {
        return this.uploadedFiles && this.uploadedFiles.length > 0;
    }

    handleTypeChange(event) {
        this.idType = event.detail.value;
        this.idNumber = '';
        this.errorMessage = '';
        this.clearClientInfo();
    }

    handleNumberChange(event) {
        this.idNumber = event.target.value;
        this.errorMessage = '';
        this.clearClientInfo();
    }

    clearClientInfo() {
        this.clientInfo = {};
        this.hasClientInfo = false;
        this.activeSections = ['idSection', 'bankSection'];
    }

    async handleSubmit() {
        this.errorMessage = '';
        this.clearClientInfo();
        
        if (!this.idType || this.idType.trim() === '') {
            this.errorMessage = 'Please select an Identification type.';
            return;
        }

        if (!this.idNumber || this.idNumber.trim() === '') {
            this.errorMessage = `Please enter ${this.getLabelForType(this.idType)} number.`;
            return;
        }

        const validationResult = this.validateFormat();
        if (!validationResult.isValid) {
            this.errorMessage = validationResult.errorMessage;
            return;
        }

        this.isSearching = true;

        try {
            const result = await searchClientByField({
                searchType: this.idType,
                searchValue: this.idNumber.trim()
            });

            if (result && Object.keys(result).length > 0) {
                this.clientInfo = {
                    CIFNumber: result.CIF_Number__c || '',
                    IDNumber: result.Identity_Number__c || '',
                    PassportNumber: result.Passport_Number__c || '',
                    Salutation: result.Salutation || '',
                    FirstName: result.FirstName || '',
                    LastName: result.LastName || '',
                    HomeContactNumber: result.Phone || '',
                    WorkContactNumber: result.Work_Contact_Number__c || '',
                    MobileNumber: result.PersonMobilePhone || '',
                    EmailAddress: result.PersonEmail || ''
                };

                this.hasClientInfo = true;
                this.activeSections = [...['idSection', 'clientSection', 'bankSection']];
                this.errorMessage = '';
            } else {
                this.errorMessage = 'No client found with the provided details.';
                this.activeSections = [...['idSection', 'bankSection']];
            }
        } catch (error) {
            this.errorMessage = error.body ? error.body.message : 'An error occurred while searching for the client.';
            this.activeSections = [...['idSection', 'bankSection']];
        } finally {
            this.isSearching = false;
        }
    }

    getLabelForType(type) {
        if (!type) return 'Identification';
        const option = this.idTypeOptions.find(opt => opt.value === type);
        return option ? option.label : type;
    }

    validateFormat() {
        if (!this.idType || !this.idNumber) {
            return { isValid: false, errorMessage: 'Please provide both ID type and number.' };
        }

        const trimmedNumber = this.idNumber.trim();
        
        if (this.idType === 'ID' && !/^\d{13}$/.test(trimmedNumber)) {
            return { isValid: false, errorMessage: 'Identification Number must be 13 digits.' };
        }

        if (this.idType === 'PASSPORT' && !/^[A-Za-z0-9]{6,9}$/.test(trimmedNumber)) {
            return { isValid: false, errorMessage: 'Passport number must be 6-9 alphanumeric characters.' };
        }

        if (this.idType === 'CIF' && !/^\d+$/.test(trimmedNumber)) {
            return { isValid: false, errorMessage: 'CIF Number must contain only digits.' };
        }

        if (this.idType === 'ACCOUNT' && !/^\d+$/.test(trimmedNumber)) {
            return { isValid: false, errorMessage: 'Account Number must contain only digits.' };
        }

        return { isValid: true };
    }

    handleUploadFinished(event) {
        if (!event || !event.detail || !event.detail.files) {
            return;
        }
        
        const newFiles = event.detail.files;
        this.uploadedFiles = [...this.uploadedFiles, ...newFiles];
        this.updateFlowAttribute();
    }

    handleRemoveFile(event) {
        if (!event || !event.detail || !event.detail.item) {
            return;
        }
        
        const docIdToRemove = event.detail.item.name;
        this.uploadedFiles = (this.uploadedFiles || []).filter(file => 
            file && file.documentId !== docIdToRemove
        );
        this.updateFlowAttribute();
    }

    updateFlowAttribute() {
        if (!this.uploadedFiles) {
            this.uploadedFiles = [];
        }
        
        this.contentDocumentIds = this.uploadedFiles
            .map(file => file && file.documentId ? file.documentId : '')
            .filter(id => id !== '')
            .join(',');
            
        this.contentDocumentId = this.uploadedFiles.length > 0 && 
                                this.uploadedFiles[0] && 
                                this.uploadedFiles[0].documentId ? 
                                this.uploadedFiles[0].documentId : '';
                                
        this.contentDocumentNames = this.uploadedFiles
            .map(file => file && file.name ? file.name : '')
            .filter(name => name !== '')
            .join(',');

        this.dispatchEvent(new FlowAttributeChangeEvent('contentDocumentIds', this.contentDocumentIds));
        this.dispatchEvent(new FlowAttributeChangeEvent('contentDocumentId', this.contentDocumentId));
        this.dispatchEvent(new FlowAttributeChangeEvent('contentDocumentNames', this.contentDocumentNames));
    }

    @api
    validate() {
        this.errorMessage = '';

        if (!this.idType || this.idType.trim() === '') {
            this.errorMessage = 'Please select an Identification type.';
            return { isValid: false, errorMessage: this.errorMessage };
        }

        if (!this.idNumber || this.idNumber.trim() === '') {
            this.errorMessage = `Please enter ${this.getLabelForType(this.idType)} number.`;
            return { isValid: false, errorMessage: this.errorMessage };
        }

        const validationResult = this.validateFormat();
        if (!validationResult.isValid) {
            this.errorMessage = validationResult.errorMessage;
            return { isValid: false, errorMessage: this.errorMessage };
        }

        if (!this.hasClientInfo) {
            this.errorMessage = 'Please search and select a valid client before proceeding.';
            return { isValid: false, errorMessage: this.errorMessage };
        }

        return { isValid: true };
    }
}