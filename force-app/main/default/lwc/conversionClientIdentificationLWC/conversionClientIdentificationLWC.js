import { LightningElement, api, track } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';

export default class ClientIdentification extends LightningElement {
    @api recordId;
    @api idType;
    @api idNumber;
    @api contentDocumentId = '';
    @api contentDocumentIds = '';
    @api contentDocumentNames = '';
    activeSections = ['idSection', 'bankSection'];
    acceptedFormats = ['.pdf', '.png', '.jpg', '.jpeg'];
    idTypeOptions = [
        { label: 'Identification Number', value: 'ID' },
        { label: 'Passport Number', value: 'PASSPORT' },
        { label: 'CIF Number', value: 'CIF' },
        { label: 'Account Number', value: 'ACCOUNT' }
    ];

    @track errorMessage = '';
    @track uploadedFiles = [];

    get filePills() {
        return this.uploadedFiles.map(file => ({
            label: file.name,
            name: file.documentId,
            iconName: 'standard:file'
        }));
    }

    get hasUploadedFiles() {
        return this.uploadedFiles.length > 0;
    }

    handleTypeChange(event) {
        this.idType = event.detail.value;
        this.idNumber = '';
        this.errorMessage = '';
    }

    handleNumberChange(event) {
        this.idNumber = event.target.value;
        this.errorMessage = '';
    }

    handleUploadFinished(event) {
        const newFiles = event.detail.files;
        this.uploadedFiles = [...this.uploadedFiles, ...newFiles];
        this.updateFlowAttribute();
    }

    handleRemoveFile(event) {
        const docIdToRemove = event.detail.item.name;
        this.uploadedFiles = this.uploadedFiles.filter(file => file.documentId !== docIdToRemove);
        this.updateFlowAttribute();
    }

    updateFlowAttribute() {
        this.contentDocumentIds = this.uploadedFiles.map(file => file.documentId).join(',');
        this.contentDocumentId = this.uploadedFiles.length > 0 ? this.uploadedFiles[0].documentId : '';
        this.contentDocumentNames = this.uploadedFiles.map(file => file.name).join(',');

        this.dispatchEvent(new FlowAttributeChangeEvent('contentDocumentIds', this.contentDocumentIds));
        this.dispatchEvent(new FlowAttributeChangeEvent('contentDocumentId', this.contentDocumentId));
        this.dispatchEvent(new FlowAttributeChangeEvent('contentDocumentNames', this.contentDocumentNames));
    }

    @api
    validate() {
        this.errorMessage = '';

        if (!this.idType) {
            this.errorMessage = 'Please select an Identification type.';
            return { isValid: false, errorMessage: this.errorMessage };
        }

        if (!this.idNumber || this.idNumber.trim() === '') {
            this.errorMessage = `Please enter ${this.idType} number.`;
            return { isValid: false, errorMessage: this.errorMessage };
        }

        if (this.idType === 'ID' && !/^\d{13}$/.test(this.idNumber)) {
            this.errorMessage = 'Identification Number must be 13 digits.';
            return { isValid: false, errorMessage: this.errorMessage };
        }

        if (this.idType === 'PASSPORT' && !/^[A-Za-z0-9]{6,9}$/.test(this.idNumber)) {
            this.errorMessage = 'Passport number must be 6-9 alphanumeric characters.';
            return { isValid: false, errorMessage: this.errorMessage };
        }

        return { isValid: true };
    }
}