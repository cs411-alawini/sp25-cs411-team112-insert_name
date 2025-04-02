## **Revised Feedback Response and Justifications**

We changed the Stage2Description and the UML diagram associated with it. 

### ***1\. UML Diagram – Missing Relationships (-1)***

***TA Comment:***

*"There are no relationships in this UML."*

***Response:***  
*We revised the UML diagram to explicitly include **relationship lines** between all entities, complete with **multiplicity notations (1:1, 1:N)** and **foreign key annotations** where appropriate. These make the dependencies and interactions between entities visually and semantically clear.*

---

### ***2\. Entity Modelling – Shipping\_Details, Category, Customer\_Scenario (-1)***

***TA Comment:***

*"Shipping details; categories; customer scenario seem more like relationships, not entities."*

***Response:***

* ***Shipping\_Details:** We retained this as an **entity** because it encapsulates multiple attributes (e.g., `Shipping_Date`, `Delay`, `Risk`, `Delivery_Status`, `Days_Scheduled`) that are specific to the logistics of fulfilment, and not inherent to the `Orders` entity. While it shares a 1:1 relationship with `Orders`, separating it allows modular growth and targeted querying for shipping analytics. In design terms, this is analogous to how `Employee` and `EmployeeDetails` may be split for performance or clarity, even in 1:1 cases.*  
* ***Category:** We argue that this represents a **real-world abstraction**: a classification of goods or services within an industry. It supports extensibility (e.g., category-specific pricing, regulation metadata, or carbon-tracking methods), and provides clearer structure in modelling orders placed across sub-domains of industries. A direct many-to-many link between `Industries` and `Orders` would ignore this intermediary concept, flattening the semantics. Therefore, this should remain an entity*   
* ***Customer\_Scenario:** Initially introduced to reflect the interactive simulation aspect (users managing specific customer cases), we now recognise this is best modelled either as a **view** (with no extra attributes are required).*  
* *We've revised our schema accordingly by removing `Customer_Scenario` as a base entity and treating the link between users and customers as a derived relationship.*

---

### ***3\. Normal Form Design – Users and Customers Separation (-1)***

*We separated Users and Customers to keep login credentials distinct from purchase and demographic data. Initially, we considered a 1:1 relationship, but that was too restrictive: in real usage, one user might oversee several customer profiles, or multiple users might share access to a single customer.*

*To address this, we introduced a many-to-many relationship between Users and Customers, typically implemented by a bridge table (e.g. `User_Customers`) that references both User\_ID and Customer\_ID. This arrangement maintains proper normalisation (neither table is forced to depend on the other's key) and gives us the flexibility to handle scenarios where:*

* *A single user logs in to manage multiple customers.*  
* *Multiple users collaborate on the same customer account.*

*Consequently, each entity stands on its own, matching real-world distinctions (users for authentication, customers for purchasing), while the intermediate table captures how they connect in dynamic, interactive scenarios.*

