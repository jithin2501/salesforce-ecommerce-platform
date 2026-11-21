public with sharing class ShopController {


    @AuraEnabled(cacheable=true) // 1. Get all products (including image URL and Category)
    public static List<Ec_Product__c> getProducts() {
        return [
            SELECT Id, Name, Price__c, Description__c, Product_Image_URL__c, Product_Category__c
            FROM Ec_Product__c
            ORDER BY Name
        ];
    }

    @AuraEnabled // 2. Place order (creates Ec_Order__c and Ec_Order_Item__c in 1 atomic transaction)
    public static String placeOrder(List<CartItemWrapper> items, String customerName) {
        if (items == null || items.isEmpty()) {
            throw new AuraHandledException('No order items received. Your cart is empty.');
        }

        Decimal total = 0;
        for (CartItemWrapper item : items) {
            if (item == null || item.productId == null || item.quantity == null || item.price == null) {
                throw new AuraHandledException('Invalid order item data.');
            }
            total += (item.price * item.quantity);
        }

        // Create Order
        Ec_Order__c ord = new Ec_Order__c(
            Order_Date__c   = Date.today(),
            Total_Amount__c = total,
            Status__c       = 'Placed',
            Customer_Name__c = customerName
        );
        insert ord;

        // Create Order Items
        List<Ec_Order_Item__c> orderItems = new List<Ec_Order_Item__c>();
        for (CartItemWrapper item : items) {
            orderItems.add(new Ec_Order_Item__c(
                Ec_Order__c   = ord.Id,
                Ec_Product__c = item.productId,
                Quantity__c   = item.quantity,
                Unit_Price__c = item.price
            ));
        }
        insert orderItems;

        return [SELECT Name FROM Ec_Order__c WHERE Id = :ord.Id].Name; //Return the order number  Salesforce to frontend
    }

    public class CartItemWrapper {
        @AuraEnabled public Id productId { get; set; }
        @AuraEnabled public String productName { get; set; }
        @AuraEnabled public Decimal quantity { get; set; }
        @AuraEnabled public Decimal price { get; set; }
    }
}
