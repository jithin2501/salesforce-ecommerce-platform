import { LightningElement, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProducts from '@salesforce/apex/ShopController.getProducts';
import placeOrder from '@salesforce/apex/ShopController.placeOrder';

export default class SimpleShop extends LightningElement {

    screen = 'products'; // COMPONENT STATE & NAVIGATION Active screen: 'products' | 'cart' | 'thanks'

    get showProducts() {
        return this.screen === 'products';
    }

    get showCart() {
        return this.screen === 'cart';
    }

    get showThanks() {
        return this.screen === 'thanks';
    }

    handleViewCart() {
        this.screen = 'cart';
    }

    handleBack() {
        this.screen = 'products';
    }

    products = []; //APEX DATABASE INTEGRATION

    @wire(getProducts)
    wiredProducts({ data, error }) {
        if (data) {
            this.products = data;
        } else if (error) {
            this.showToast('Error', this.getMessage(error), 'error');
        }
    }


    searchTerm = ''; //SEARCH & CATEGORY FILTERING LOGIC
    selectedCategory = 'All';

    // Generates unique category options for dropdown from the products list
    get categoryOptions() {
        const categories = new Set();
        this.products.forEach(p => {
            if (p.Product_Category__c) {
                categories.add(p.Product_Category__c);
            }
        });

        const options = [{ label: 'All Categories', value: 'All' }];
        categories.forEach(cat => {
            options.push({ label: cat, value: cat });
        });
        return options;
    }

    get filteredProducts() { // In-memory filtering by selected category AND search term (Name + Description)
        let list = this.products;

        if (this.selectedCategory && this.selectedCategory !== 'All') {
            list = list.filter(p => p.Product_Category__c === this.selectedCategory);
        }
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            list = list.filter(p =>
                (p.Name && p.Name.toLowerCase().includes(term)) ||
                (p.Description__c && p.Description__c.toLowerCase().includes(term))
            );
        }

        return list;
    }

    get hasProducts() {
        return this.filteredProducts.length > 0;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
    }

    handleCategoryChange(event) {
        this.selectedCategory = event.detail.value;
    }

    cartItems = []; //CART MANAGEMENT (Add, Increment, Decrement, Remove, Totals)

    get hasCartItems() {
        return this.cartItems.length > 0;
    }

    get cartCount() {
        return this.cartItems.reduce((total, item) => total + item.quantity, 0);
    }

    get cartTotal() {
        return this.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    }

    get cartButtonLabel() {
        return `View Cart (${this.cartCount})`;
    }

    handleAddToCart(event) {
        const productId = event.target.dataset.id;
        const product = this.products.find(p => p.Id === productId);
        if (!product) return;

        const existingItem = this.cartItems.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity += 1;
            existingItem.subtotal = existingItem.quantity * existingItem.price;
            this.cartItems = [...this.cartItems];
        } else {
            this.cartItems = [
                ...this.cartItems,
                {
                    productId: product.Id,
                    productName: product.Name,
                    price: product.Price__c || 0,
                    quantity: 1,
                    subtotal: product.Price__c || 0,
                    imageUrl: product.Product_Image_URL__c
                }
            ];
        }

        this.showToast('Added', `${product.Name} added to cart`, 'success');
    }

    handleIncrement(event) {
        const productId = event.target.dataset.id;
        const item = this.cartItems.find(i => i.productId === productId);
        if (item) {
            item.quantity += 1;
            item.subtotal = item.quantity * item.price;
            this.cartItems = [...this.cartItems];
        }
    }

    handleDecrement(event) {
        const productId = event.target.dataset.id;
        const item = this.cartItems.find(i => i.productId === productId);
        if (item) {
            if (item.quantity > 1) {
                item.quantity -= 1;
                item.subtotal = item.quantity * item.price;
                this.cartItems = [...this.cartItems];
            } else {
                this.handleRemove(event);
            }
        }
    }

    handleRemove(event) {
        const productId = event.target.dataset.id;
        this.cartItems = this.cartItems.filter(i => i.productId !== productId);
    }

    customerName = ''; //CHECKOUT & ORDER PLACEMENT
    isPlacingOrder = false;
    confirmedOrderNumber = '';
    confirmedCustomerName = '';

    get placeOrderButtonLabel() {
        return this.isPlacingOrder ? 'Placing Order...' : 'Place Order';
    }

    handleNameChange(event) {
        this.customerName = event.target.value;
    }

    handlePlaceOrder() {
        if (this.cartItems.length === 0) {
            this.showToast('Warning', 'Your cart is empty', 'warning');
            return;
        }

        if (!this.customerName || !this.customerName.trim()) {
            this.showToast('Warning', 'Please enter your name before placing the order', 'warning');
            return;
        }

        this.isPlacingOrder = true;
        const payload = this.cartItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price
        }));

        placeOrder({ items: payload, customerName: this.customerName.trim() })
            .then(orderName => {
                this.confirmedOrderNumber = orderName;
                this.confirmedCustomerName = this.customerName.trim();
                this.cartItems = [];
                this.customerName = '';
                this.screen = 'thanks';
            })
            .catch(error => {
                this.showToast('Error', this.getMessage(error), 'error');
            })
            .finally(() => {
                this.isPlacingOrder = false;
            });
    }

    handleImageError(event) { // UI HELPERS & UTILITIES
        event.target.style.display = 'none';
    }

    getMessage(error) {
        return error && error.body && error.body.message
            ? error.body.message : 'Something went wrong';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
