# dnd-kit docs
DndContext
Application structure
Context provider
In order for your your Droppable and Draggable components to interact with each other, you'll need to make sure that the part of your React tree that uses them is nested within  a parent <DndContext> component. The <DndContext> provider makes use of the React Context API to share data between draggable and droppable components and hooks.

React context provides a way to pass data through the component tree without having to pass props down manually at every level.

Therefore, components that use useDraggable, useDroppable  or DragOverlay will need to be nested within a DndContext provider.

 They don't need to be direct descendants, but, there does need to be a parent <DndContext> provider somewhere higher up in the tree.

Copy
import React from 'react';
import {DndContext} from '@dnd-kit/core';

function App() {
  return (
    <DndContext>
      {/* Components that use `useDraggable`, `useDroppable` */}
    </DndContext>
  );
}
Nesting
You may also nest <DndContext> providers within other <DndContext> providers to achieve nested draggable/droppable interfaces that are independent of one another.

Copy
import React from 'react';
import {DndContext} from '@dnd-kit/core';

function App() {
  return (
    <DndContext>
      {/* Components that use `useDraggable`, `useDroppable` */}
      <DndContext>
        {/* ... */}
        <DndContext>
          {/* ... */}
        </DndContext>
      </DndContext>
    </DndContext>
  );
}
When nesting DndContext providers, keep in mind that the useDroppable and useDraggable hooks will only have access to the other draggable and droppable nodes within that context.

If multiple DndContext providers are listening for the same event, events will be captured by the first DndContext that contains a Sensor that is activated by that event, similar to how events bubble in the DOM.

Props
Copy
interface Props {
  announcements?: Announcements;
  autoScroll?: boolean;
  cancelDrop?: CancelDrop;
  children?: React.ReactNode;
  collisionDetection?: CollisionDetection;
  layoutMeasuring?: Partial<LayoutMeasuring>;
  modifiers?: Modifiers;
  screenReaderInstructions?: ScreenReaderInstructions;
  sensors?: SensorDescriptor<any>[];
  onDragStart?(event: DragStartEvent): void;
  onDragMove?(event: DragMoveEvent): void;
  onDragOver?(event: DragOverEvent): void;
  onDragEnd?(event: DragEndEvent): void;
  onDragCancel?(): void;
}
Event handlers
As you can see from the list of props above, there are a number of different events emitted by <DndContext> that you can listen to and decide how to handle.

The main events you can listen to are:

onDragStart
Fires when a drag event that meets the activation constraints for that sensor happens, along with the unique identifier of the draggable element that was picked up.

onDragMove
Fires anytime as the draggable item is moved. Depending on the activated sensor, this could for example be as the Pointer is moved or the Keyboard movement keys are pressed.

onDragOver 
Fires when a draggable item is moved over a droppable container, along with the unique identifier of that droppable container.

onDragEnd 
Fires after a draggable item is dropped. 

This event contains information about the active draggable id along with information on whether the draggable item was dropped over. 

If there are no collisions detected when the draggable item is dropped, the over property will be null. If a collision is detected, the over property will contain the id of the droppable over which it was dropped.

It's important to understand that the onDragEnd event does not move draggable items into droppable containers. 

Rather, it provides information about which draggable item was dropped and whether it was over a droppable container when it was dropped.

It is up to the consumer of DndContext to decide what to do with that information and how to react to it, for example, by updating (or not) its internal state in response to the event so that the items are declaratively rendered in a different parent droppable.

onDragCancel
Fires if a drag operation is cancelled, for example, if the user presses escape while dragging a draggable item.

Accessibility
For more details and best practices around accessibility of draggable and droppable components, read the accessibility section:

Accessibility
Announcements
Use the announcements prop to customize the screen reader announcements that are announced in the live region when draggable items are picked up, moved over droppable regions, and dropped.

The default announcements are:

Copy
const defaultAnnouncements = {
  onDragStart(id) {
    return `Picked up draggable item ${id}.`;
  },
  onDragOver(id, overId) {
    if (overId) {
      return `Draggable item ${id} was moved over droppable area ${overId}.`;
    }

    return `Draggable item ${id} is no longer over a droppable area.`;
  },
  onDragEnd(id, overId) {
    if (overId) {
      return `Draggable item was dropped over droppable area ${overId}`;
    }

    return `Draggable item ${id} was dropped.`;
  },
  onDragCancel(id) {
    return `Dragging was cancelled. Draggable item ${id} was dropped.`;
  },
}
While these default announcements are sensible defaults that should cover most simple use cases, you know your application best, and we highly recommend that you customize these to provide a screen reader experience that is more tailored to the use case you are building.

Screen reader instructions
Use the screenReaderInstructions prop to customize the instructions that are read to screen readers when the focus is moved 

Autoscroll
Use the optional autoScroll boolean prop to temporarily or permanently disable auto-scrolling for all sensors used within this DndContext.

Auto-scrolling may also be disabled on an individual sensor basis using the static property autoScrollEnabled of the sensor. For example, the Keyboard sensor manages scrolling internally, and therefore has the static property autoScrollEnabled set to false.

Collision detection
Use the collisionDetection prop to customize the collision detection algorithm used to detect collisions between draggable nodes and droppable areas within theDndContext provider. 

The default collision detection algorithm is the rectangle intersection algorithm.

The built-in collision detection algorithms are:

Rectangle intersection

Closest center

Closest corners

You may also build custom collision detection algorithms or compose existing ones.

To learn more, read the collision detection guide:

Collision detection algorithms
Sensors
Sensors are an abstraction to detect different input methods in order to initiate drag operations, respond to movement and end or cancel the operation. 

The default sensors used by DndContext are the Pointer and Keyboard sensors.

To learn how to customize sensors or how to pass different sensors to DndContext, read the Sensors guide:

Sensors
Modifiers
Modifiers let you dynamically modify the movement coordinates that are detected by sensors. They can be used for a wide range of use cases, for example:

Restricting motion to a single axis

Restricting motion to the draggable node container's bounding rectangle 

Restricting motion to the draggable node's scroll container bounding rectangle

Applying resistance or clamping the motion

To learn more about how to use Modifiers, read the Modifiers guide:

Modifiers
Layout measuring
You can configure when and how often DndContext  should measure its droppable elements by using the layoutMeasuring prop. 

The frequency argument controls how frequently layouts should be measured. By default, layout measuring is set to optimized, which only measures layouts based on the strategy.

Specify one of the following strategies:

LayoutMeasuringStrategy.WhileDragging: Default behavior, only measure droppable elements right after dragging has begun.

LayoutMeasuringStrategy.BeforeDragging:  Measure droppable elements before dragging begins and right after it ends. 

LayoutMeasuringStrategy.Always: Measure droppable elements before dragging begins, right after dragging has begun, and after it ends.

Example usage:

Copy
import {DndContext, LayoutMeasuringStrategy} from '@dnd-kit/core';

<DndContext layoutMeasuring={{strategy: LayoutMeasuringStrategy.Always}} />




API Documentation
DndContext
Collision detection algorithms
If you're familiar with how 2D games are built, you may have come across the notion of collision detection algorithms.

One of the simpler forms of collision detection is between two rectangles that are axis aligned — meaning rectangles that are not rotated. This form of collision detection is generally referred to as Axis-Aligned Bounding Box (AABB).

The built-in collision detection algorithms assume a rectangular bounding box.

The bounding box of an element is the smallest possible rectangle (aligned with the axes of that element's user coordinate system) that entirely encloses it and its descendants.
– Source: MDN

This means that even if the draggable or droppable nodes look round or triangular, their bounding boxes will still be rectangular:


If you'd like to use other shapes than rectangles for detecting collisions, build your own custom collision detection algorithm.

Rectangle intersection
By default, DndContext uses the rectangle intersection collision detection algorithm. 

The algorithm works by ensuring there is no gap between any of the 4 sides of the rectangles. Any gap means a collision does not exist.

This means that in order for a draggable item to be considered over a droppable area, there needs to be an intersection between both rectangles:


Closest center
While the rectangle intersection algorithm is well suited for most drag and drop use cases, it can be unforgiving, since it requires both the draggable and droppable bounding rectangles to come into direct contact and intersect.

For some use cases, such as sortable lists, using a more forgiving collision detection algorithm is recommended. 

As its name suggests, the closest center algorithm finds the droppable container who's center is closest to  the center of the bounding rectangle of the active draggable item:


Closest corners
Like to the closest center algorithm, the closest corner algorithm doesn't require the draggable and droppable rectangles to intersect.

Rather, it measures the distance between all four corners of the active draggable item and the four corners of each droppable container to find the closest one. 


The distance is measured from the top left corner of the draggable item to the top left corner of the droppable bounding rectangle, top right to top right, bottom left to bottom left, and bottom right to bottom right. 

When should I use the closest corners algorithm instead of closest center?
In most cases, the closest center algorithm works well, and is generally the recommended default for sortable lists because it provides a more forgiving experience than the rectangle intersection algorithm.

In general, the closest center and closest corners algorithms will yield the same results. However, when building interfaces where droppable containers are stacked on top of one another, for example, when building a Kanban, the closest center algorithm can sometimes return the underlaying droppable of the entire Kanban column rather than the droppable areas within that column. 


Closest center is 'A', though the human eye would likely expect 'A2'
In those situations, the closest corners algorithm is preferred and will yield results that are more aligned with what the human eye would predict:


Closest corners is 'A2', as the human eye would expect.
Pointer within
As its name suggests, the pointer within collision detection algorithm only registers collision when the pointer is contained within the bounding rectangle of other droppable containers.

This collision detection algorithm is well suited for high precision drag and drop interfaces.

As its name suggests, this collision detection algorithm only works with pointer-based sensors. For this reason, we suggest you use composition of collision detection algorithms if you intend to use the pointerWithin collision detection algorithm so that you can fall back to a different collision detection algorithm for the Keyboard sensor.

Custom collision detection algorithms
In advanced use cases, you may want to build your own collision detection algorithms if the ones provided out of the box do not suit your use case.

You can either write a new collision detection algorithm from scratch, or compose two or more existing collision detection algorithms.

Composition of existing algorithms
Sometimes, you don't need to build custom collision detection algorithms from scratch. Instead, you can compose existing collision algorithms to augment them.

A common example of this is when using the pointerWithin collision detection algorithm. As its name suggest, this collision detection algorithm depends on pointer coordinates, and therefore does not work when using other sensors like the Keyboard sensor. It's also a very high precision collision detection algorithm, so it can sometimes be helpful to fall back to a more tolerant collision detection algorithm when the pointerWithin algorithm does not return any collisions.

Copy
import {pointerWithin, rectIntersection} from '@dnd-kit/core';

function customCollisionDetectionAlgorithm(args) {
  // First, let's see if there are any collisions with the pointer
  const pointerCollisions = pointerWithin(args);
  
  // Collision detection algorithms return an array of collisions
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  
  // If there are no collisions with the pointer, return rectangle intersections
  return rectIntersection(args);
};
Another example where composition of existing algorithms can be useful is if you want some of your droppable containers to have a different collision detection algorithm than the others. 

For instance, if you were building a sortable list that also supported moving items to a trash bin, you may want to compose both the closestCenter and rectangleIntersection collision detection algorithms.


Use the closest corners algorithm for all droppables except 'trash'.

Use the intersection detection algorithm for the 'trash' droppable.
From an implementation perspective, the custom intersection algorithm described in the example above would look like:

Copy
import {closestCorners, rectIntersection} from '@dnd-kit/core';

function customCollisionDetectionAlgorithm({
  droppableContainers,
  ...args,
}) {
  // First, let's see if the `trash` droppable rect is intersecting
  const rectIntersectionCollisions = rectIntersection({
    ...args,
    droppableContainers: droppableContainers.filter(({id}) => id === 'trash')
  });
  
  // Collision detection algorithms return an array of collisions
  if (rectIntersectionCollisions.length > 0) {
    // The trash is intersecting, return early
    return rectIntersectionCollisions;
  }
  
  // Compute other collisions
  return closestCorners({
    ...args,
    droppableContainers: droppableContainers.filter(({id}) => id !== 'trash')
  });
};
Building custom collision detection algorithms
For advanced use cases or to detect collision between non-rectangular or non-axis aligned shapes, you'll want to build your own collision detection algorithms.

Here's an example to detect collisions between circles instead of rectangles:

Copy
/**
 * Sort collisions in descending order (from greatest to smallest value)
 */
export function sortCollisionsDesc(
  {data: {value: a}},
  {data: {value: b}}
) {
  return b - a;
}

function getCircleIntersection(entry, target) {
  // Abstracted the logic to calculate the radius for simplicity
  var circle1 = {radius: 20, x: entry.offsetLeft, y: entry.offsetTop};
  var circle2 = {radius: 12, x: target.offsetLeft, y: target.offsetTop};

  var dx = circle1.x - circle2.x;
  var dy = circle1.y - circle2.y;
  var distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < circle1.radius + circle2.radius) {
    return distance;
  }

  return 0;
}

/**
 * Returns the circle that has the greatest intersection area
 */
function circleIntersection({
  collisionRect,
  droppableRects,
  droppableContainers,
}) => {
  const collisions = [];

  for (const droppableContainer of droppableContainers) {
    const {id} = droppableContainer;
    const rect = droppableRects.get(id);

    if (rect) {
      const intersectionRatio = getCircleIntersection(rect, collisionRect);

      if (intersectionRatio > 0) {
        collisions.push({
          id,
          data: {droppableContainer, value: intersectionRatio},
        });
      }
    }
  }

  return collisions.sort(sortCollisionsDesc);
};
To learn more, refer to the implementation of the built-in collision detection algorithms.

Last updated 2 years ago


API Documentation
DndContext
useDndContext
For advanced use-cases, for example, if you're building your own presets on top of @dnd-kit/core, you may want to have access to the internal context of <DndContext> that the useDraggable and useDroppable have access to.

Copy
import {useDndContext} from '@dnd-kit/core';

function CustomPreset() {
  const dndContext = useDndContext();
}
If you think the preset you're building could be useful to others, feel free to open up a PR for discussion in the dnd-kit repository.

Last updated 3 years ago

useDndMonitor
The useDndMonitor hook can be used within components wrapped in a DndContext provider to monitor the different drag and drop events that happen for that DndContext.

Copy
import {DndContext, useDndMonitor} from '@dnd-kit/core';

function App() {
  return (
    <DndContext>
      <Component />
    </DndContext>
  );
}

function Component() {
  // Monitor drag and drop events that happen on the parent `DndContext` provider
  useDndMonitor({
    onDragStart(event) {},
    onDragMove(event) {},
    onDragOver(event) {},
    onDragEnd(event) {},
    onDragCancel(event) {},
  });
}
Last updated 3 years ago

Droppable

Use the useDroppable hook to set up DOM nodes as droppable areas that draggable elements can be dropped over. 

Usage
The useDroppable hook isn't opinionated about how you should structure your application. 

At minimum though, you need to pass the setNodeRef function that is returned by the useDroppable hook to a DOM element so that it can register the underlying DOM node and keep track of it to detect collisions and intersections with other draggable elements. 

 If the concept of ref is new to you, we recommend you first check out the Refs and the DOM article on the React documentation website.

Copy
import {useDroppable} from '@dnd-kit/core';


function Droppable() {
  const {setNodeRef} = useDroppable({
    id: 'unique-id',
  });
  
  return (
    <div ref={setNodeRef}>
      /* Render whatever you like within */
    </div>
  );
}
You can set up as many droppable containers as you want, just make sure they all have a unique id so that they can be differentiated. Each droppable needs to have its own unique node though, so make sure you don't try to connect a single droppable to multiple refs.

To set up multiple droppable targets, simply use the useDroppable hook as many times as needed.

Copy
function MultipleDroppables() {
  const {setNodeRef: setFirstDroppableRef} = useDroppable({
    id: 'droppable-1',
  });
  const {setNodeRef: setsecondDroppableRef} = useDroppable({
    id: 'droppable-2',
  });
  
  return (
    <section>
      <div ref={setFirstDroppableRef}>
        /* Render whatever you like within */
      </div>
      <div ref={setsecondDroppableRef}>
        /* Render whatever you like within */
      </div>
    </section>
  );
}
If you need to dynamically render a list of droppable containers, we recommend you create a re-usable Droppable component and render that component as many times as needed:

Copy
function Droppable(props) {
  const {setNodeRef} = useDroppable({
    id: props.id,
  });
  
  return (
    <div ref={setNodeRef}>
      {props.children}
    </div>
  );
}

function MultipleDroppables() {
  const droppables = ['1', '2', '3', '4'];
  
  return (
    <section>
      {droppables.map((id) => (
        <Droppable id={id} key={id}>
          Droppable container id: ${id}
        </Droppable>
      ))}
    </section>
  );
}
For more details usage of the useDroppable hook, refer to the API documentation section:

API Documentation
Droppable
useDroppable

Arguments
Copy
interface UseDroppableArguments {
  id: string | number;
  disabled?: boolean;
  data?: Record<string, any>;
}
Identifier
The id argument is a string or number that should be a unique identifier, meaning there should be no other droppable elements that share that same identifier within a given DndContext provider.

If you're building a component that uses both the useDroppable and useDraggable hooks, they can both share the same identifier since droppable elements are stored in a different key-value store than draggable elements.

Disabled
Since hooks cannot be conditionally invoked, use the disabled argument and set it to true if you need to temporarily disable a droppable area.

Data
The data argument is for advanced use-cases where you may need access to additional data about the droppable element in event handlers, modifiers or custom sensors.

For example, if you were building a sortable preset, you could use the data attribute to store the index of the droppable element within a sortable list to access it within a custom sensor.

Copy
const {setNodeRef} = useDroppable({
  id: props.id,
  data: {
    index: props.index,
  },
});
Another more advanced example where the data argument can be useful is create relationships between draggable nodes and droppable areas, for example, to specify which types of draggable nodes your droppable accepts:

Copy
import {DndContext, useDraggable, useDroppable} from '@dnd-kit/core';

function Droppable() {
  const {setNodeRef} = useDroppable({
    id: 'droppable',
    data: {
      accepts: ['type1', 'type2'],
    },
  });

  /* ... */
}

function Draggable() {
  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: 'draggable',
    data: {
      type: 'type1',
    },
  });

  /* ... */
}

function App() {
  return (
    <DndContext onDragEnd={handleDragEnd}>
      /* ... */
    </DndContext>
  );
  
  function handleDragEnd(event) {
    const {active, over} = event;

    if (over && over.data.current.accepts.includes(active.data.current.type)) {
      // do stuff
    }
  }
}
Properties
Copy
{
  rect: React.MutableRefObject<LayoutRect | null>;
  isOver: boolean;
  node: React.RefObject<HTMLElement>;
  over: {id: UniqueIdentifier} | null;
  setNodeRef(element: HTMLElement | null): void;
}
Node
setNodeRef
In order for the useDroppable hook to function properly, it needs the setNodeRef property to be attached to the HTML element you intend on turning into a droppable area:

Copy
function Droppable(props) {
  const {setNodeRef} = useDroppable({
    id: props.id,
  });
  
  return (
    <div ref={setNodeRef}>
      {/* ... */}
    </div>
  );
}
node
A ref to the current node that is passed to setNodeRef

rect
For advanced use cases, if you need the bounding rect measurement of the droppable area.

Over
isOver
Use the isOver boolean returned by the useDroppable hook to change the appearance or content displayed when a draggable element is dragged over your droppable container. 

over
If you'd like to change the appearance of the droppable in response to a draggable being dragged over a different droppable container, check whether the over value is defined. Depending on your use-case, you can also read the id of the other droppable that the draggable item to make changes to the render output of your droppable component.

API Documentation
Draggable

Use the useDraggable hook turn DOM nodes into draggable sources that can be picked up, moved and dropped over droppable containers.

Usage
The useDraggable hook isn't particularly opinionated about how your app should be structured. 

Node ref
At minimum though, you need to pass the setNodeRef function that is returned by the useDraggable hook to a DOM element so that it can access the underlying DOM node and keep track of it to detect collisions and intersections with other droppable elements. 

Copy
import {useDraggable} from '@dnd-kit/core';
import {CSS} from '@dnd-kit/utilities';


function Draggable() {
  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: 'unique-id',
  });
  const style = {
    transform: CSS.Translate.toString(transform),
  };
  
  return (
    <button ref={setNodeRef} style={style} {...listeners} {...attributes}>
      /* Render whatever you like within */
    </button>
  );
}
Always try to use the  DOM element that is most semantic in the context of your app. 
Check out our Accessibility guide to learn more about how you can help provide a better experience for screen readers.

Identifier
The id argument is a string that should be a unique identifier, meaning there should be no other draggable elements that share that same identifier within a given DndContext provider.

Listeners
The useDraggable hook requires that you attach listeners to the DOM node that you would like to become the activator to start dragging. 

While we could have attached these listeners manually to the node  provided to setNodeRef, there are actually a number of key advantages to forcing the consumer to manually attach the listeners.

Flexibility
While many drag and drop libraries need to expose the concept of "drag handles", creating a drag handle with the useDraggable hook is as simple as manually attaching the listeners to a different DOM element than the one that is set as the draggable source DOM node:

Copy
import {useDraggable} from '@dnd-kit/core';


function Draggable() {
  const {attributes, listeners, setNodeRef} = useDraggable({
    id: 'unique-id',
  });
  
  return (
    <div ref={setNodeRef}>
      /* Some other content that does not activate dragging */
      <button {...listeners} {...attributes}>Drag handle</button>
    </div>
  );
}
When attaching the listeners to a different element than the node that is draggable, make sure you also attach the attributes to the same node that has the listeners attached so that it is still accessible. 

You can even have multiple drag handles if that makes sense in the context of your application:

Copy
import {useDraggable} from '@dnd-kit/core';


function Draggable() {
  const {attributes, listeners, setNodeRef} = useDraggable({
    id: 'unique-id',
  });
  
  return (
    <div ref={setNodeRef}>
      <button {...listeners} {...attributes}>Drag handle 1</button>
      /* Some other content that does not activate dragging */
      <button {...listeners} {...attributes}>Drag handle 2</button>
    </div>
  );
}
Performance
This strategy also means that we're able to use React synthetic events, which ultimately leads to improved performance over manually attaching event listeners to each individual node.

Why? Because rather than having to attach individual event listeners for each draggable DOM node, React attaches a single event listener for every type of event we listen to on the document. Once click on one of the draggable nodes happens, React's listener on the document dispatches a SyntheticEvent back to the original handler. 

Transforms 
In order to actually see your draggable items move on screen, you'll need to move the item using CSS. You can use inline styles, CSS variables, or even CSS-in-JS libraries to pass the transform property as CSS to your draggable element.

For performance reasons, we strongly recommend you use the transform CSS property to move your draggable item on the screen, as other positional properties such as top, left or margin can cause expensive repaints.  Learn more about CSS transforms.

After an item starts being dragged, the transform property will be populated with the translate coordinates you'll need to move the item on the screen.  The transform object adheres to the following shape: {x: number, y: number, scaleX: number, scaleY: number}

The x and y coordinates represent the delta from the point of origin of your draggable element since it started being dragged.

The scaleX and scaleY properties represent the difference in scale between the item that is dragged and the droppable container it is currently over. This is useful for building interfaces where the draggable item needs to adapt to the size of the droppable container it is currently over.

The CSS helper is entirely optional; it's a convenient helper for generating CSS transform strings, and is equivalent to manually constructing the string as such:

Copy
CSS.Translate.toString(transform) ===
`translate3d(${translate.x}, ${translate.y}, 0)`
Attributes
The useDraggable hook provides a set of sensible default attributes for draggable items. We recommend you attach these to the HTML element you are attaching the draggable listeners to.

We encourage you to manually attach the attributes that you think make sense in the context of your application rather than using them all without considering whether it makes sense to do so.

For example, if the HTML element you are attaching the useDraggable listeners to is already a semantic button, although it's harmless to do so, there's no need to add the role="button" attribute, since that is already the default role. 

Attribute

Default value

Description

role

"button"

If possible, we recommend you use a semantic <button> element for the DOM element you plan on attaching draggable listeners to. 

In case that's not possible, make sure you include the role="button"attribute, which is the default value.

tabIndex

"0"

In order for your draggable elements to receive keyboard focus, they need to have the tabindex attribute set to 0 if they are not natively interactive elements (such as the HTML button element). For this reason, the useDraggable hook sets the tabindex="0" attribute by default.

aria-roledescription

"draggable"

While draggable is a sensible default, we recommend you customize this value to something that is tailored to the use case you are building.

aria-describedby

"DndContext-[uniqueId]"

Each draggable item is provided a unique aria-describedby ID that points to the screen reader instructions to be read out when a draggable item receives focus.

To learn more about the best practices for making draggable interfaces accessible, read the full accessibility guide:

Accessibility
Recommendations
touch-action
We highly recommend you specify the touch-action CSS property for all of your draggable elements.

The touch-action CSS property sets how an element's region can be manipulated by a touchscreen user (for example, by zooming features built into the browser).

Source: MDN

In general, we recommend you set the touch-action property to none for draggable elements in order to prevent scrolling on mobile devices. 

For Pointer Events, there is no way to prevent the default behaviour of the browser on touch devices when interacting with a draggable element from the pointer event listeners. Using touch-action: none; is the only way to reliably prevent scrolling for pointer events.

Further,  using touch-action: none; is currently the only reliable way to prevent scrolling in iOS Safari for both Touch and Pointer events. 

If your draggable item is part of a scrollable list, we recommend you use a drag handle and set touch-action to none only for the drag handle, so that the contents of the list can still be scrolled, but that initiating a drag from the drag handle does not scroll the page.

Once a pointerdown or touchstart event has been initiated, any changes to the touch-action value will be ignored. Programmatically changing the touch-action value for an element from auto to none after a pointer or touch event has been initiated will not result in the user agent aborting or suppressing any default behavior for that event for as long as that pointer is active  (for more details, refer to the Pointer Events Level 2 Spec).

Drag Overlay
The <DragOverlay> component provides a way to render a draggable overlay that is removed from the normal document flow and is positioned relative to the viewport.


To learn more about how to use drag overlays, read the in-depth guide:

useDraggable

Arguments
Copy
interface UseDraggableArguments {
  id: string | number;
  attributes?: {
    role?: string;
    roleDescription?: string;
    tabIndex?: number;
  },
  data?: Record<string, any>;
  disabled?: boolean;
}
Identifier
The id argument is a string or number that should be a unique identifier, meaning there should be no other draggable elements that share that same identifier within a given DndContext provider.

If you're building a component that uses both the useDraggable and useDroppable hooks, they can both share the same identifier since draggable elements are stored in a different key-value store than droppable elements.

Data
The data argument is for advanced use-cases where you may need access to additional data about the draggable element in event handlers, modifiers or custom sensors.

For example, if you were building a sortable preset, you could use the data attribute to store the index of the draggable element within a sortable list to access it within a custom sensor.

Copy
const {setNodeRef} = useDraggable({
  id: props.id,
  data: {
    index: props.index,
  },
});
Another more advanced example where the data argument can be useful is create relationships between draggable nodes and droppable areas, for example, to specify which types of droppable nodes your draggable node can be dropped on:

Copy
import {DndContext, useDraggable, useDroppable} from '@dnd-kit/core';

function Droppable() {
  const {setNodeRef} = useDroppable({
    id: 'droppable',
    data: {
      type: 'type1',
    },
  });

  /* ... */
}

function Draggable() {
  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: 'draggable',
    data: {
      supports: ['type1', 'type2'],
    },
  });

  /* ... */
}

function App() {
  return (
    <DndContext onDragEnd={handleDragEnd}>
      /* ... */
    </DndContext>
  );
  
  function handleDragEnd(event) {
    const {active, over} = event;

    if (over && active.data.current.supports.includes(over.data.current.type)) {
      // do stuff
    }
  }
}
Disabled
Since hooks cannot be conditionally invoked, use the disabled argument and set it to true if you need to temporarily disable a draggable element.

Attributes
The default values for the attributes property are sensible defaults that should cover a wide range of use cases, but there is no one-size-fits-all solution.

You know your application best, and we encourage you to manually attach only the attributes that you think make sense in the context of your application rather than using them all without considering whether it makes sense to do so. 

For example, if the HTML element you are attaching the useDraggable listeners to is already a native HTML button element, although it's harmless to do so, there's no need to add the role="button" attribute, since that is already the default role of button. 

Role
The ARIA "role" attribute lets you explicitly define the role for an element, which communicates its purpose to assistive technologies.

The default value for the "role" attribute is "button". 

If it makes sense in the context of what you are building, we recommend that you leverage the native HTML <button> element for draggable elements.

Role description
The roleDescription argument can be used to tailor the screen reader experience to your application. For example, if you're building a sortable list of products you'd want to set the roleDescription value to something like "sortable product".

Tab index

The tabindex attribute dictates the order in which focus moves throughout the document.

Natively interactive elements such as buttons, anchor tags and form controls have a default tabindex value of 0. 

Custom elements that are intended to be interactive and receive keyboard focus need to have an explicitly assigned tabindex="0"(for example, div and li elements)

In other words, in order for your draggable elements to receive keyboard focus, they need to have the tabindex attribute set to 0 if they are not natively interactive elements (such as the HTML button element).

For this reason, the useDraggable hook sets the tabindex="0" attribute by default.

Properties
Copy
{
  active: {
    id: UniqueIdentifier;
    node: React.MutableRefObject<HTMLElement>;
    rect: ViewRect;
  } | null;
  attributes: {
    role: string;
    tabIndex: number;
    'aria-diabled': boolean;
    'aria-roledescription': string;
    'aria-describedby': string;
  },
  isDragging: boolean;
  listeners: Record<SyntheticListenerName, Function> | undefined;
  node: React.MutableRefObject<HTMLElement | null>;
  over: {id: UniqueIdentifier} | null;
  setNodeRef(HTMLElement | null): void;
  setActivatorNodeRef(HTMLElement | null): void;
  transform: {x: number, y: number, scaleX: number, scaleY: number} | null;
}
Active
active
If there is currently an active draggable element within the DndContext provider where the useDraggable hook is used, the active property will be defined with the corresponding id, node and rect of that draggable element. 

Otherwise, the active property will be set to null.

isDragging
If the draggable element that is currently being dragged is the current one where useDraggable is used, the isDragging property will be true. Otherwise the isDragging property will be false.

Internally, the isActive property just checks if the active.id === id.

Listeners
The useDraggable hook requires that you attach listeners to the DOM node that you would like to become the activator to start dragging. 

While we could have attached these listeners manually to the node  provided to setNodeRef, there are actually a number of key advantages to forcing the consumer to manually attach the listeners.

Flexibility
While many drag and drop libraries need to expose the concept of "drag handles", creating a drag handle with the useDraggable hook is as simple as manually attaching the listeners to a different DOM element than the one that is set as the draggable source DOM node:

Copy
import {useDraggable} from '@dnd-kit/core';


function Draggable() {
  const {attributes, listeners, setNodeRef} = useDraggable({
    id: 'unique-id',
  });
  
  return (
    <div ref={setNodeRef}>
      /* Some other content that does not activate dragging */
      <button {...listeners} {...attributes}>Drag handle</button>
    </div>
  );
}
When attaching the listeners to a different element than the node that is draggable, make sure you also attach the attributes to the same node that has the listeners attached so that it is still accessible. 

You can even have multiple drag handles if that makes sense in the context of your application:

Copy
import {useDraggable} from '@dnd-kit/core';


function Draggable() {
  const {attributes, listeners, setNodeRef} = useDraggable({
    id: 'unique-id',
  });
  
  return (
    <div ref={setNodeRef}>
      <button {...listeners} {...attributes}>Drag handle 1</button>
      /* Some other content that does not activate dragging */
      <button {...listeners} {...attributes}>Drag handle 2</button>
    </div>
  );
}
Performance
This strategy also means that we're able to use React synthetic events, which ultimately leads to improved performance over manually attaching event listeners to each individual node.

Why? Because rather than having to attach individual event listeners for each draggable DOM node, React attaches a single event listener for every type of event we listen to on the document. Once click on one of the draggable nodes happens, React's listener on the document dispatches a SyntheticEvent back to the original handler. 

Node
setNodeRef

In order for the useDraggable hook to function properly, it needs the setNodeRef property to be attached to the HTML element you intend on turning into a draggable element so that @dnd-kit can measure that element to compute collisions:

Copy
function Draggable(props) {
  const {setNodeRef} = useDraggable({
    id: props.id,
  });
  
  return (
    <button ref={setNodeRef}>
      {/* ... */}
    </button>
  );
}
Keep in mind that the ref should be assigned to the outer container that you want to become draggable, but this doesn't necessarily need to coincide with the container that the listeners are attached to.

node
A ref to the current node that is passed to setNodeRef

Activator
setActivatorNodeRef

It's possible for the listeners to be attached to a different node than the one that setNodeRef is attached to.

A common example of this is when implementing a drag handle and attaching the listeners to the drag handle:

Copy
function Draggable(props) {
  const {listeners, setNodeRef} = useDraggable({
    id: props.id,
  });
  
  return (
    <div ref={setNodeRef}>
      {/* ... */}
      <button {...listeners}>Drag handle</button>
    </div>
  );
}
When the activator node differs from the draggable node, we recommend setting the activator node ref on the activator node:

Copy
function Draggable(props) {
  const {listeners, setNodeRef, setActivatorNodeRef} = useDraggable({
    id: props.id,
  });
  
  return (
    <div ref={setNodeRef}>
      {/* ... */}
      <button ref={setActivatorNodeRef} {...listeners}>Drag handle</button>
    </div>
  );
}
This helps @dnd-kit more accurately handle automatic focus management and can also be accessed by sensors for enhanced activation constraints.

Focus management is automatically handled by @dnd-kit. When the activator event is a Keyboard event, focus will automatically be restored back to the first focusable node of the activator node.

If no activator node is set via setActivatorNodeRef, focus will automatically be restored on the first focusable node of the draggable node registered via setNodeRef.

Over
over
If you'd like to change the appearance of the draggable element in response to it being dragged over a different droppable container, check whether the over value is defined. 

If a draggable element is moved over a droppable area, the over property will be defined for all draggable elements, regardless of whether or not those draggable elements are active or not.

If you'd like to make changes to only the active draggable element in response to it being moved over a droppable area, check whether the isDragging property is true.

Transform
After a draggable item is picked up, the transform property will be populated with the translate coordinates you'll need to move the item on the screen.  

The transform object adheres to the following shape: 

Copy
{
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}
The x and y coordinates represent the delta from the point of origin of your draggable element since it started being dragged.

The scaleX and scaleY properties represent the difference in scale between the element that is currently being dragged and the droppable it is currently over, which can be useful if the draggable item needs to be dynamically resized to the size of the droppable it is over.

Drag Overlay
The <DragOverlay> component provides a way to render a draggable overlay that is removed from the normal document flow and is positioned relative to the viewport.


When should I use a drag overlay?
Depending on your use-case, you may want to use a drag overlay rather than transforming the original draggable source element that is connected to the useDraggable hook:

If you'd like to show a preview of where the draggable source will be when dropped, you can update the position of the draggable source while dragging without affecting the drag overlay.

If your item needs to move from one container to another while dragging, we strongly recommend you use the <DragOverlay> component so the draggable item can unmount from its original container while dragging and mount back into a different container without affecting the drag overlay.

If your draggable item is within a scrollable container, we also recommend you use a <DragOverlay>, otherwise you'll need to set the draggable element to position: fixed yourself so the item isn't restricted to the overflow and stacking context of its scroll container, and can move without being affected by the scroll position of its container.

If your useDraggable items are within a virtualized list, you will absolutely want to use a drag overlay, since the original drag source can unmount while dragging as the virtualized container is scrolled.

If you want smooth drop animations without the effort of building them yourself.

Usage
You may render any valid JSX within the children of the <DragOverlay>. 

The <DragOverlay> component should remain mounted at all times so that it can perform the drop animation. If you conditionally render the <DragOverlay> component, drop animations will not work.

As a rule of thumb, try to render the <DragOverlay> outside of your draggable components, and follow the presentational component pattern to maintain a good separation of concerns.

Instead, you should conditionally render the children passed to the <DragOverlay>:

App.jsx
Draggable.jsx
Copy
import React, {useState} from 'react';
import {DndContext, DragOverlay} from '@dnd-kit/core';

import {Draggable} from './Draggable';

/* The implementation details of <Item> and <ScrollableList> are not
 * relevant for this example and are therefore omitted. */

function App() {
  const [items] = useState(['1', '2', '3', '4', '5']);
  const [activeId, setActiveId] = useState(null);
  
  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <ScrollableList>
        {items.map(id =>
          <Draggable key={id} id={id}>
            <Item value={`Item ${id}`} />
          </Draggable>
        )}
      </ScrollableList>
      
      <DragOverlay>
        {activeId ? (
          <Item value={`Item ${activeId}`} /> 
        ): null}
      </DragOverlay>
    </DndContext>
  );
  
  function handleDragStart(event) {
    setActiveId(event.active.id);
  }
  
  function handleDragEnd() {
    setActiveId(null);
  }
}
Patterns
Presentational components
While this is an optional pattern, we recommend that the components you intend to make draggable be presentational components that are decoupled from @dnd-kit.

Using this pattern, create a presentational version of your component that you intend on rendering within the drag overlay, and another version that is draggable and renders the presentational component.

Wrapper nodes
As you may have noticed from the example above, we can create small abstract components that render a wrapper node and make any children rendered within draggable:

Draggable.jsx
Copy
import React from 'react';
import {useDraggable} from '@dnd-kit/core';

function Draggable(props) {
  const Element = props.element || 'div';
  const {attributes, listeners, setNodeRef} = useDraggable({
    id: props.id,
  });
  
  return (
    <Element ref={setNodeRef} {...listeners} {...attributes}>
      {props.children}
    </Element>
  );
}
Using this pattern, we can then render our presentational components within <Draggable> and within <DragOverlay>:

App.jsx
Copy
import React, {useState} from 'react';
import {DndContext, DragOverlay} from '@dnd-kit/core';

import {Draggable} from './Draggable';

/* The implementation details of <Item> is not
 * relevant for this example and therefore omitted. */

function App() {
  const [isDragging, setIsDragging] = useState(false);
  
  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Draggable id="my-draggable-element">
        <Item />
      </Draggable>
      
      <DragOverlay>
        {isDragging ? (
          <Item />
        ): null}
      </DragOverlay>
    </DndContext>
  );
  
  function handleDragStart() {
    setIsDragging(true);
  }
  
  function handleDragEnd() {
    setIsDragging(false);
  }
}
Ref forwarding
Use the ref forwarding pattern to connect your presentational components to the useDraggable hook:

Copy
import React, {forwardRef} from 'react';

const Item = forwardRef(({children, ...props}, ref) => {
  return (
    <li {...props} ref={ref}>{children}</li>
  )
});
This way, you can create two versions of your component, one that is presentational, and one that is draggable and renders the presentational component without the need for additional wrapper elements:

Copy
import React from 'react';
import {useDraggable} from '@dnd-kit/core';

function DraggableItem(props) {
  const {attributes, listeners, setNodeRef} = useDraggable({
    id: props.id,
  });
  
  return (
    <Item ref={setNodeRef} {...attributes} {...listeners}>
      {value}
    </Item>
  )
});
Portals
The drag overlay is not rendered in a portal by default. Rather, it is rendered in the container where it is rendered. 

If you would like to render the <DragOverlay> in a different container than where it is rendered, import the createPortal helper from react-dom:

Copy
import React, {useState} from 'react';
import {createPortal} from 'react-dom';
import {DndContext, DragOverlay} from '@dnd-kit/core';

function App() {
  return (
    <DndContext>
      {createPortal(
        <DragOverlay>{/* ... */}</DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
Props
Copy
{
  adjustScale?: boolean;
  children?: React.ReactNode;
  className?: string;
  dropAnimation?: DropAnimation | null;
  style?: React.CSSProperties;
  transition?: string | TransitionGetter;
  modifiers?: Modifiers;
  wrapperElement?: keyof JSX.IntrinsicElements;
  zIndex?: number;
}
Children
You may render any valid JSX within the children of the <DragOverlay>. However, make sure that the components rendered within the drag overlay do not use the useDraggable hook.

Prefer conditionally rendering the children of <DragOverlay> rather than conditionally rendering <DragOverlay>, otherwise drop animations will not work.

Class name and inline styles
If you'd like to customize the wrapper element that the DragOverlay's children are rendered into, use the className and style props:

Copy
<DragOverlay
  className="my-drag-overlay"
  style={{
    width: 500,
  }}
>
  {/* ... */}
</DragOverlay>
Drop animation
Use the dropAnimation prop to configure the drop animation.

Copy
interface DropAnimation {
  duration: number;
  easing: string;
}
The duration option should be a number, in milliseconds. The default value is 250 milliseconds. The easing option should be a string that represents a valid CSS easing function. The default easing is ease.

Copy
<DragOverlay dropAnimation={{
  duration: 500,
  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
}}>
  {/* ... */}
</DragOverlay>
To disable drop animations, set the dropAnimation prop to null.

Copy
<DragOverlay dropAnimation={null}>
  {/* ... */}
</DragOverlay>
The <DragOverlay> component should remain mounted at all times so that it can perform the drop animation. If you conditionally render the <DragOverlay> component, drop animations will not work.

Modifiers
Modifiers let you dynamically modify the movement coordinates that are detected by sensors. They can be used for a wide range of use-cases, which you can learn more about by reading the Modifiers documentation.

For example, you can use modifiers to restrict the movement of the <DragOverlay> to the bounds of the window:

Copy
import {DndContext, DragOverlay} from '@dnd-kit';
import {
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';

function App() {
  return (
    <DndContext>
      {/* ... */}
      <DragOverlay modifiers={[restrictToWindowEdges]}>
        {/* ... */}
      </DragOverlay>
    </DndContext>
  )
}
Transition
By default, the <DragOverlay> component does not have any transitions, unless activated by the Keyboard sensor. Use the transition prop to create a function that returns the transition based on the activator event. The default implementation is:

Copy
function defaultTransition(activatorEvent) {
  const isKeyboardActivator = activatorEvent instanceof KeyboardEvent;

  return isKeyboardActivator ? 'transform 250ms ease' : undefined;
};
Wrapper element
By default, the <DragOverlay> component renders your elements within a div element. If your draggable elements are list items, you'll want to update the <DragOverlay> component to render a ul wrapper instead, since wrapping a li item without a parent ul is invalid HTML:

Copy
<DragOverlay wrapperElement="ul">
  {/* ... */}
</DragOverlay>
z-index
The zIndex prop sets the z-order of the drag overlay. The default value is 999 for compatibility reasons, but we highly recommend you use a lower value. 
Sensors
Concepts
Sensors are an abstraction to detect different input methods in order to initiate drag operations, respond to movement and end or cancel the operation. 

Activators
Sensors may define one or multiple activator events. Activator events use React  SyntheticEvent listeners, which leads to improved performance over manually adding event listeners to each individual draggable node.

Sensors are initialized once one of the activator events is detected.

Built-in sensors
The built-in sensors are:

Pointer

Mouse

Touch

Keyboard

Custom sensors
If necessary, you may also implement custom sensors to respond to other inputs or if the built-in sensors do not suit your needs. If you build a custom sensor and you think others could benefit, don't hesitate to open an RFC pull request.

Lifecycle
The lifecycle of a sensor is as follows:

Activator event detected, if the event is qualified, sensor class is initialized. 

Sensor manually attaches new listeners to input methods upon initialization.

Sensor dispatches drag start event once constraints are met.

Sensor dispatches drag move events in response to input.

Sensor dispatches drag end or drag cancel event.

Sensor is torn down and cleans up manually attached event listeners.

From an implementation perspective, Sensors are classes. 

They are class-based rather than hooks because they need to be instantiated synchronously to respond to user interactions immediately, and it must be possible for them to be  conditionally invoked.

Hooks
useSensor
By default, DndContext uses the Pointer and Keyboard sensors.

If you'd like to use other sensors, such as the Mouse and Touch sensors instead, initialize those sensors separately with the options you'd like to use using the useSensor hook

Copy
import {MouseSensor, TouchSensor, useSensor} from '@dnd-kit/core';

function App() {
  const mouseSensor = useSensor(MouseSensor, {
    // Require the mouse to move by 10 pixels before activating
    activationConstraint: {
      distance: 10,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    // Press delay of 250ms, with tolerance of 5px of movement
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });
}
useSensors
When initializing sensors with useSensor, make sure you pass the sensors to useSensors before passing them to DndContext:

Copy
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

function App() {
  const mouseSensor = useSensor(MouseSensor);
  const touchSensor = useSensor(TouchSensor);
  const keyboardSensor = useSensor(KeyboardSensor);
  
  const sensors = useSensors(
    mouseSensor,
    touchSensor,
    keyboardSensor,
  );
  
  return (
    <DndContext sensors={sensors}>
      {/* ... */}
    </DndContext>
  )
}
In other examples across the documentation, you may also see sensors initialized without intermediate variables, which is equivalent to the syntax above:

Copy
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

function App() {
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );
  
  return (
    <DndContext sensors={sensors}>
      {/* ... */}
    </DndContext>
  )
}

Pointer
The Pointer sensor responds to Pointer events.  It is one of the default sensors used by the DndContext provider if none are defined.

Pointer events are DOM events that are fired for a pointing device. They are designed to create a single DOM event model to handle pointing input devices such as a mouse, pen/stylus or touch (such as one or more fingers).

The pointer is a hardware-agnostic device that can target a specific set of screen coordinates. Having a single event model for pointers can simplify creating Web sites and applications and provide a good user experience regardless of the user's hardware.

– Source: MDN

Activator
The pointer activator is the onPointerDown event handler. The Pointer sensor is initialized if the pointer event was triggered by the primary pointer.

For mouse there is only one pointer, so it will always be the primary pointer. For touch input, a pointer is considered primary if the user touched the screen when there were no other active touches. For pen and stylus input, a pointer is considered primary if the user's pen initially contacted the screen when there were no other active pens contacting the screen.

Activation constraints
The Pointer sensor has two activation constraints:

Distance constraint

Delay constraint

These activation constraints are mutually exclusive and may not be used simultaneously. 

Distance
The distance constraint subscribes to the following interface:

Copy
interface DistanceConstraint {
  distance: number;
}
The distance property represents the distance, in pixels, by which the pointer needs to be moved before a drag start event is emitted.

Delay
The delay constraint subscribe to the following interface:

Copy
interface DelayConstraint {
  delay: number;
  tolerance: number;
}
The delay property represents the duration, in milliseconds, that a draggable item needs to be held by the primary pointer for before a drag start event is emitted. 

The tolerance property represents the distance, in pixels, of motion that is tolerated before the drag operation is aborted. If the pointer is moved during the delay duration and the tolerance is set to zero, the drag operation will be immediately aborted. If a higher tolerance is set, for example, a tolerance of 5 pixels, the operation will only be aborted if the pointer is moved by more than 5 pixels during the delay.

This property is particularly useful for touch input, where some tolerance should be accounted for when using a delay constraint, as touch input is less precise than mouse input.

Recommendations
touch-action
We highly recommend you specify the touch-action CSS property for all of your draggable elements.

The touch-action CSS property sets how an element's region can be manipulated by a touchscreen user (for example, by zooming features built into the browser).

Source: MDN

In general, we recommend you set the touch-action property to none for draggable elements in order to prevent scrolling on mobile devices. 

For Pointer Events, there is no way to prevent the default behaviour of the browser on touch devices when interacting with a draggable element from the pointer event listeners. Using touch-action: none; is the only way to reliably prevent scrolling for pointer events.

If your draggable item is part of a scrollable list, we recommend you use a drag handle and set touch-action to none only for the drag handle, so that the contents of the list can still be scrolled, but that initiating a drag from the drag handle does not scroll the page.

If  the above recommendations are not suitable for your use-case, we recommend that you use both the Mouse and Touch sensors instead, as Touch events do not suffer the same limitations as Pointer events, and it is possible to prevent the page from scrolling in touchmove events.

Once a pointerdown or touchstart event has been initiated, any changes to the touch-action value will be ignored. Programmatically changing the touch-action value for an element from auto to none after a pointer or touch event has been initiated will not result in the user agent aborting or suppressing any default behavior for that event for as long as that pointer is active (for more details, refer to the Pointer Events Level 2 Spec).

Mouse
The Mouse sensor responds to Mouse events. Mouse events represent events that occur due to the user interacting with a pointing device (such as a mouse).

Activator
The mouse activator is the onMouseDown event handler. The Mouse sensor is initialized if the mouse down event was triggered by the left mouse button.

Activation constraints
Like the Pointer sensor, the Mouse sensor has two activation constraints:

Distance constraint

Delay constraint

These activation constraints are mutually exclusive and may not be used simultaneously. 

Distance
The distance constraint subscribes to the following interface:

Copy
interface DistanceConstraint {
  distance: number;
}
The distance property represents the distance, in pixels, by which the mouse needs to be moved before a drag start event is emitted.

Delay
The delay constraint subscribe to the following interface:

Copy
interface DelayConstraint {
  delay: number;
  tolerance: number;
}
The delay property represents the duration, in milliseconds, that a draggable item needs to be held by the mouse for before a drag start event is emitted. 

The tolerance property represents the distance, in pixels, of motion that is tolerated before the drag operation is aborted. If the mouse is moved during the delay duration and the tolerance is set to zero, the drag operation will be immediately aborted. If a higher tolerance is set, for example, a tolerance of 5 pixels, the operation will only be aborted if the mouse is moved by more than 5 pixels during the delay.

Touch
The Touch sensor responds to Touch events. Touch events offer the ability to interpret finger or stylus activity on touch screens or trackpads.

Activator
The touch activator is the onTouchStart event handler. The Touch sensor is initialized if the there is no more than a single touch on the event.touches property.

Activation constraints
Like the Pointer sensor, the Touch sensor has two activation constraints:

Distance constraint

Delay constraint

These activation constraints are mutually exclusive and may not be used simultaneously. 

Distance
The distance constraint subscribes to the following interface:

Copy
interface DistanceConstraint {
  distance: number;
}
The distance property represents the distance, in pixels, by which the touch input needs to be moved before a drag start event is emitted.

Delay
The delay constraint subscribe to the following interface:

Copy
interface DelayConstraint {
  delay: number;
  tolerance: number;
}
The delay property represents the duration, in milliseconds, that a draggable item needs to be held by the touch input before a drag start event is emitted. 

The tolerance property represents the distance, in pixels, of motion that is tolerated before the drag operation is aborted. If the finger or stylus is moved during the delay duration and the tolerance is set to zero, the drag operation will be immediately aborted. If a higher tolerance is set, for example, a tolerance of 5 pixels, the operation will only be aborted if the finger is moved by more than 5 pixels during the delay.

This property is particularly useful for touch input, where some tolerance should be accounted for when using a delay constraint, as touch input is less precise than mouse input.

Recommendations
touch-action
We highly recommend you specify the touch-action CSS property for all of your draggable elements.

The touch-action CSS property sets how an element's region can be manipulated by a touchscreen user (for example, by zooming features built into the browser).

Source: MDN

In general, we recommend you set the touch-action property to manipulation for draggable elements when using the Touch sensor. 

Touch events do not suffer the same limitations as Pointer events, and it is possible to prevent the page from scrolling in touchmove events.

Keyboard
The Keyboard sensor responds to Keyboard events. It is one of the default sensors used by the DndContext provider if none are defined.

In order for the Keyboard sensor to function properly, the activator element that receives the useDraggable listeners must be able to receive focus. To learn more, read the in-depth Accessibility guide.

Activator
The keyboard activator is the onKeyDown event handler. The Keyboard sensor is initialized if the event.code property matches one of the start keys passed to keyboardCodes option of the Keyboard sensor.

By default, the keys that activate the Keyboard sensor are Space and Enter.

Options
Keyboard codes
This option represents the keys that are associated with the drag start, cancel and end events. The keyboardCodes options adheres to the following interface:

Copy
type KeyboardCode = KeyboardEvent['code'];

interface KeyboardCodes {
  start: KeyboardCode[];
  cancel: KeyboardCode[];
  end: KeyboardCode[];
};
The default values are:

Copy
const defaultKeyboardCodes = {
  start: ['Space', 'Enter'],
  cancel: ['Escape'],
  end: ['Space', 'Enter'],
};
You can customize these values, but keep in mind that the third rule of ARIA requires that a user must be able to activate the action associated with a draggable widget using both the enter (on Windows) or return (on macOS) and the space key. To learn more, read the in-depth accessibility guide.

Keep in mind that you should also customize the screen reader instructions using the screenReaderInstructions prop of <DndContext> if you update these values, as the screen reader instructions assume that the Keyboard sensor is initialized with the default keyboard shortcuts.

The move keyboard codes are not a customizable option, because those are handled by the coordinate getter function. To customize them, write a custom coordinate getter function.

Coordinates getter
By default, the Keyboard sensor moves in any given direction by 25 pixels when any of the arrow keys are pressed while dragging.

This is an arbitrary sensible default that may or may not be suited to the use case you are building.

The getNextCoordinates option can be used to define a custom coordinate getter function that is passed the latest keyboard event along with the current coordinates:

Copy
function customCoordinatesGetter(event, args) {
  const {currentCoordinates} = args;
  const delta = 50;
  
  switch (event.code) {
    case 'Right':
      return {
        ...currentCoordinates,
        x: currentCoordinates.x + delta,
      };
    case 'Left':
      return {
        ...currentCoordinates,
        x: currentCoordinates.x - delta,
      };
    case 'Down':
      return {
        ...currentCoordinates,
        y: currentCoordinates.y + delta,
      };
    case 'Up':
      return {
        ...currentCoordinates,
        y: currentCoordinates.y - delta,
      };
  }

  return undefined;
};
While the example above is fairly simple, you can build complex coordinate getters to support advanced use cases. The Sortable preset uses the getNextCoordinates option to build on top of the Keyboard sensor and move the active sortable item to its new index depending on the arrow key that is pressed.

Scroll behavior
This option represents the scroll behavior that should be used when scrolling to new coordinates. The default value is smooth, which results in the scroll container being scrolled smoothly to the new coordinates. 

The other possible value is auto, which results in the scroll container being scrolled directly to the new coordinates without any animation.

Modifiers
Modifiers let you dynamically modify the movement coordinates that are detected by sensors. They can be used for a wide range of use cases, for example:

Restricting motion to a single axis

Restricting motion to the draggable node container's bounding rectangle 

Restricting motion to the draggable node's scroll container bounding rectangle

Applying resistance or clamping the motion

Installation
To start using modifiers, install the modifiers package via yarn or npm:

Copy
npm install @dnd-kit/modifiers
Usage
The modifiers repository contains a number of useful modifiers that can be applied on DndContext as well as DragOverlay.

Copy
import {DndContext, DragOverlay} from '@dnd-kit';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';

function App() {
  return (
    <DndContext modifiers={[restrictToVerticalAxis]}>
      {/* ... */}
      <DragOverlay modifiers={[restrictToWindowEdges]}>
        {/* ... */}
      </DragOverlay>
    </DndContext>
  )
}
As you can see from the example above, DndContext and DragOverlay can both have different modifiers.

Built-in modifiers
Restricting motion to an axis
restrictToHorizontalAxis
Restrict movement to only the horizontal axis.

restrictToVerticalAxis
Restrict movement to only the vertical axis.

Restrict motion to a container's bounding rectangle
restrictToWindowEdges
Restrict movement to the edges of the window. This modifier can be useful to prevent the DragOverlay from being moved outside of the bounds of the window.

restrictToParentElement
Restrict movement to the parent element of the draggable item that is picked up.

restrictToFirstScrollableAncestor
Restrict movement to the first scrollable ancestor of the draggable item that is picked up.

Snap to grid
createSnapModifier
Function to create modifiers to snap to a given grid size. 

Copy
import {createSnapModifier} from '@dnd-kit/modifiers';

const gridSize = 20; // pixels
const snapToGridModifier = createSnapModifier(gridSize);
Building custom modifiers
To build your own custom modifiers, refer to the implementation of the built-in modifiers of @dnd-kit/modifiers: https://github.com/clauderic/dnd-kit/tree/master/packages/modifiers/src

For example, here is an implementation to create a modifier to snap to grid:

Copy
const gridSize = 20;

function snapToGrid(args) {
  const {transform} = args;
  
  return {
    ...transform,
    x: Math.ceil(transform.x / gridSize) * gridSize,
    y: Math.ceil(transform.y / gridSize) * gridSize,
  };
 }

 Sortable
The sortable preset provides the building blocks to build sortable interfaces.

Installation
To get started, install the sortable preset via npm or yarn:

Copy
npm install @dnd-kit/sortable
Overview
If you're eager to get started right away, here's the code you'll need:

App.jsx
SortableItem.jsx
Copy
import React, {useState} from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {SortableItem} from './SortableItem';

function App() {
  const [items, setItems] = useState([1, 2, 3]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={items}
        strategy={verticalListSortingStrategy}
      >
        {items.map(id => <SortableItem key={id} id={id} />)}
      </SortableContext>
    </DndContext>
  );
  
  function handleDragEnd(event) {
    const {active, over} = event;
    
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }
}
For most sortable lists, we recommend you use a DragOverlay if your sortable list is scrollable or if the contents of the scrollable list are taller than the viewport of the window. Check out the sortable drag overlay guide below to learn more.

Architecture
The sortable preset builds on top of the primitives exposed by @dnd-kit/core to help building sortable interfaces.

The sortable preset exposes two main concepts: SortableContext and the useSortable hook:

The SortableContext provides information via context that is consumed by the useSortable hook.

The useSortable hook is an abstraction that composes the useDroppable and useDraggable hooks:


Single container
At a high level, the application structure to implement a sortable list with a single container looks as follows:


Multiple containers
To implement sortable list with items that can be dropped within multiple containers, the application structure is the same, but we add as many SortableContext providers as we have containers:


In this example, we would use the onDragOver callback of DndContext to detect when a draggable element is moved over a different container to insert it in that new container while dragging.

If you paid close attention to the illustration above, you may also have noticed that we added a droppable zone around each sortable context. This isn't required, but will likely be the behaviour most people want. If you move all sortable items from one column into the other, you will need a droppable zone for the empty column so that you may drag sortable items back into that empty column:


Concepts
Sortable Context
In addition to the DndContext provider, the Sortable preset requires its own context provider that contains the sorted array of the unique identifiers associated to each sortable item:

Copy
import React, {useState} from 'react';
import {DndContext} from '@dnd-kit/core';
import {SortableContext} from '@dnd-kit/sortable';

function App() {
  const [items] = useState(['1', '2', '3']);

  return (
    <DndContext>
      <SortableContext items={items}>
        {/* ... */}
      </SortableContext>
    </DndContext>
  );
}
The SortableContext provides information via context that is consumed by the useSortable hook, which is covered in greater detail in the next section.

It's important that the items prop passed to SortableContext be sorted in the same order in which the items are rendered, otherwise you may see unexpected results.

It does not expose any callback props. To know when a sortable (draggable) item is being picked or moved over another sortable (droppable) item, use the callback props of DndContext:

Copy
import React, {useState} from 'react';
import {DndContext} from '@dnd-kit/core';
import {SortableContext} from '@dnd-kit/sortable';

function App() {
  const [items] = useState(['1', '2', '3']);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={items}>
        {/* ... */}
      </SortableContext>
    </DndContext>
  );
  
  function handleDragEnd(event) {
    /* ... */
  }
}
In order for the SortableContext component to function properly, make sure it is a descendant of a DndContext provider. You may nest multiple SortableContext components within the same parent DndContext.

useSortable
As outlined above, the useSortable hook combines both the useDraggable and useDroppable hooks to connect elements as both draggable sources and drop targets:


In most cases, the draggable and droppable hooks will be attached to the same node, and therefore be identical in size. They are represented as different nodes for illustration purposes above.

If you're already familiar with the useDraggable hook, the useSortable hook should look very familiar, since, it is an abstraction on top of it.

In addition to the attributes, listeners,transform and setNodeRef properties, which you should already be familiar with if you've used the useDraggable hook before, you'll notice that the useSortable hook also provides a transition property.

The transform property for useSortable represents the displacement and change of scale transformation that a sortable item needs to apply to transition to its new position without needing to update the DOM order.

The transform property for the useSortable hook behaves similarly to the transform property of the useDraggable hook for the active sortable item, when there is no DragOverlay being used.

SortableItem.jsx
Copy
import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

function SortableItem(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id: props.id});
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* ... */}
    </div>
  );
}
The default transition is 250 milliseconds, with an easing function set to ease, but you can customize this and pass any valid CSS transition timing function, or set the transition argument to null to disable transitions entirely:

Copy
const {
  transition,
} = useSortable({
  id: props.id,
  transition: {
    duration: 150, // milliseconds
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  },
});
For more details on the useSortable hook, read the full API documentation.

Sensors
Sensors are an abstraction to manage and listen to different input methods. If you're unfamiliar with the concept of sensors, we recommend you read the introduction to sensors first.

By default, the Keyboard sensor moves the active draggable item by 25 pixels in the direction of the arrow key that was pressed. This is an arbitrary default, and can be customized using the coordinateGetter option of the keyboard sensor.

The sortable preset ships with a custom coordinate getter function for the keyboard sensor that moves the active draggable to the closest sortable element in a given direction within the same DndContext.

To use it, import the sortableKeyboardCoordinates coordinate getter function provided by @dnd-kit/sortable, and pass it to the coordiniateGetter option of the Keyboard sensor.

In this example, we'll also be setting up the Pointer sensor, which is the other sensor that is enabled by default on DndContext if none are defined. We use the useSensor and useSensors hooks to initialize the sensors:

Copy
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

function App() {
  const [items] = useState(['1', '2', '3']);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext sensors={sensors}>
      <SortableContext items={items}>
        {/* ... */}
      </SortableContext>
    </DndContext>
  );
}
If you'd like to use the Mouse and Touch sensors instead of the Pointer sensor, simply initialize those sensors instead:

Copy
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

function App() {
  const [items] = useState(['1', '2', '3']);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Require the mouse to move by 10 pixels before activating
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      // Press delay of 250ms, with tolerance of 5px of movement
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext sensors={sensors}>
      <SortableContext items={items}>
        {/* ... */}
      </SortableContext>
    </DndContext>
  );
}
To learn more about sensors, read the in-depth documentation on sensors:

Sensors
Sorting strategies
The supported use cases of the Sortable preset include vertical lists, horizontal lists, grids, and virtualized lists. Because of the wide variety of use cases supported, it would be difficult to write a single strategy to cover all of these different use cases. Instead, the sortable preset exposes a number of different strategies you can use, that are tailored to these various use cases:

rectSortingStrategy: This is the default value, and is suitable for most use cases. This strategy does not support virtualized lists.

verticalListSortingStrategy: This strategy is optimized for vertical lists, and supports virtualized lists.

horizontalListSortingStrategy: This strategy is optimized for horizontal lists, and supports virtualized lists.

rectSwappingStrategy: Use this strategy to achieve swappable functionality.

Make sure to use the sorting strategy that is the most adapted to the use case you are building for.

Collision detection algorithm
The default collision detection algorithm of DndContext is the rectangle intersection algorithm. While the rectangle intersection strategy is well suited for many use cases, it can be unforgiving, since it requires both the draggable and droppable bounding rectangles to come into direct contact and intersect.

For sortable lists, we recommend using a more forgiving collision detection strategy such as the closest center or closest corners algorithms.

In this example, we'll be using the closest center algorithm:

Copy
import {DndContext, closestCenter} from '@dnd-kit/core';
import {SortableContext} from '@dnd-kit/sortable';

function App() {
  const [items] = useState(['1', '2', '3']);

  return (
    <DndContext collisionDetection={closestCenter}>
      <SortableContext items={items}>
        {/* ... */}
      </SortableContext>
    </DndContext>
  );
}
To learn more about collision detection algorithms and when to use one over the other, read our guide on collision detection algorithms:

Collision detection algorithms
Connecting all the pieces
First, let's go ahead and render all of our sortable items:

App.jsx
SortableItem.jsx
Copy
import React, {useState} from 'react';
import {DndContext} from '@dnd-kit/core';
import {SortableContext} from '@dnd-kit/sortable';

import {SortableItem} from './SortableItem';

function App() {
  const [items] = useState(['1', '2', '3']);
  
  return (
    <DndContext>
      <SortableContext items={items}>
        {items.map(id => <SortableItem key={id} id={id} />)}
      </SortableContext>
    </DndContext>
  );
}
Next, let's wire up the custom sensors for DndContext and add a custom collision detection strategy:

App.jsx
SortableItem.jsx
Copy
import React, {useState} from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';


import {SortableItem} from './SortableItem';

function App() {
  const [items] = useState(['1', '2', '3']);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}>
      <SortableContext items={items}>
        {items.map(id => <SortableItem key={id} id={id} />)}
      </SortableContext>
    </DndContext>
  );
}
In this example, we'll be building a vertical sortable list, so we will be using the verticalListSortingStrategy sorting strategy:

Copy
import React, {useState} from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {SortableItem} from './SortableItem';

function App() {
  const [items] = useState(['1', '2', '3']);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}>
      <SortableContext 
        items={items}
        strategy={verticalListSortingStrategy}
      >
        {items.map(id => <SortableItem key={id} id={id} />)}
      </SortableContext>
    </DndContext>
  );
}
Finally, we'll need to set up event handlers on the DndContext provider in order to update the order of the items on drag end.

Copy
import React, {useState} from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {SortableItem} from './SortableItem';

function App() {
  const [items, setItems] = useState(['1', '2', '3']);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={items}
        strategy={verticalListSortingStrategy}
      >
        {items.map(id => <SortableItem key={id} id={id} />)}
      </SortableContext>
    </DndContext>
  );
  
  function handleDragEnd(event) {
    const {active, over} = event;
    
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }
}
Drag Overlay
For most sortable lists, we recommend you use a DragOverlay if your sortable list is scrollable or if the contents of the scrollable list are taller than the viewport of the window.

The <DragOverlay> component provides a way to render a draggable overlay that is removed from the normal document flow and is positioned relative to the viewport. The drag overlay also implements drop animations.

A common pitfall when using the DragOverlay component is rendering the same component that calls useSortable inside the DragOverlay. This will lead to unexpected results, since there will be an id collision between the two components both calling useDraggable with the same id, since useSortable is an abstraction on top of useDraggable.

Instead, create a presentational version of your component that you intend on rendering in the drag overlay, and another version that is sortable and renders the presentational component. There are two recommended patterns for this, either using wrapper nodes or ref forwarding.

In this example, we'll use the ref forwarding pattern to avoid introducing wrapper nodes:

App.jsx
SortableItem.jsx
Item.jsx
Copy
import React, {useState} from 'react';
import {
  closestCenter,
  DndContext, 
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {SortableItem} from './SortableItem';
import {Item} from './Item';

function App() {
  const [activeId, setActiveId] = useState(null);
  const [items, setItems] = useState(['1', '2', '3']);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={items}
        strategy={verticalListSortingStrategy}
      >
        {items.map(id => <SortableItem key={id} id={id} />)}
      </SortableContext>
      <DragOverlay>
        {activeId ? <Item id={activeId} /> : null}
      </DragOverlay>
    </DndContext>
  );
  
  function handleDragStart(event) {
    const {active} = event;
    
    setActiveId(active.id);
  }
  
  function handleDragEnd(event) {
    const {active, over} = event;
    
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    
    setActiveId(null);
  }
}

Sortable Context
The SortableContext provides information via context that is consumed by the useSortable hook.

Props
Items
It requires that you pass it a sorted array of the unique identifiers associated with the elements that use the useSortable hook within it.

Copy
import React, {useState} from 'react';
import {DndContext} from '@dnd-kit/core';
import {SortableContext} from '@dnd-kit/sortable';

function App() {
  const [items] = useState([1, 2, 3]);

  return (
    <DndContext>
      <SortableContext items={items}>
        {/* ... */}
      </SortableContext>
    </DndContext>
  );
}
It's important that the items prop passed to SortableContext be sorted in the same order in which the items are rendered, otherwise you may see unexpected results.

Strategy
The SortableContext component also accepts different sorting strategies to compute transforms for the useSortable hook. The built in strategies include:

rectSortingStrategy:  This is the default value, and is suitable for most use cases. This strategy does not support virtualized lists.

verticalListSortingStrategy: This strategy is optimized for vertical lists, and supports virtualized lists.

horizontalListSortingStrategy: This strategy is optimized for horizontal lists, and supports virtualized lists.

rectSwappingStrategy: Use this strategy to achieve swappable functionality.

Make sure to use the sorting strategy that is the most adapted to the use case you are building for. 

For advanced use cases, you may also build custom sorting strategies. To do so, make sure that the custom strategy you are building accepts the arguments that are passed to a sorting strategy and adheres to the return values that are expected. For more details on this, refer to the implementation of the built-in sorting strategies.

Identifier
The SortableContext component also optionally accepts an id prop. If an id is not provided, one will be auto-generated for you. The id prop is for advanced use cases. If you're building custom sensors, you'll have access to each sortable element's data prop, which will contain the containerId associated to that sortable context.

Usage
In order for the SortableContext component to function properly, make sure it is a descendant of a DndContext provider. 

You may nest multiple SortableContext providers within the same parent DndContext provider.

You may also nest SortableContext providers within other SortableContext providers, either all under the same DndContext provider or each with their own individual DndContext providers if you would like to configure them with different options:

Copy
// Bad, missing parent <DndContext>
<SortableContext>
  {/* ... */}
</SortableContext>

// Good, basic setup
<DndContext>
  <SortableContext>
    {/* ... */}
  </SortableContext>
</DndContext>

// Good, multiple sibling Sortable contexts
<DndContext>
  <SortableContext>
    {/* ... */}
  </SortableContext>
  <SortableContext>
    {/* ... */}
  </SortableContext>
</DndContext>

// Good, nested DndContexts
<DndContext>
  <SortableContext items={["A, "B", "C"]}>
    <DndContext>
      <SortableContext items={["A, "B", "C"]}>
        {/* ... */}
      </SortableContext>
    </DndContext>
  </SortableContext>
</DndContext>

// Bad, nested Sortable contexts with `id` collisions
<DndContext>
  <SortableContext items={["A, "B", "C"]}>
    <SortableContext items={["A, "B", "C"]}>
      {/* ... */}
    </SortableContext>
  </SortableContext>
</DndContext>

// Good, nested Sortable contexts with unique `id`s
<DndContext>
  <SortableContext items={["A, "B", "C"]}>
    <SortableContext items={[1, 2, 3]}>
      {/* ... */}
    </SortableContext>
  </SortableContext>
</DndContext>

useSortable
The useSortable hook is an abstraction that composes the useDroppable and useDraggable hooks.


To function properly, the useSortable hook needs to be used within a descendant of a SortableContext provider higher up in the tree.

Usage
If you're already familiar with the useDraggable hook, the useSortable hook should look very familiar, since, it is an abstraction on top of it.

In addition to the attributes, listeners,transform and setNodeRef arguments, which you should already be familiar with if you've used the useDraggable hook before, you'll notice that the useSortable hook also provides a transition argument.

Copy
import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

function SortableItem(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id: props.id});
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* ... */}
    </li>
  );
}
Properties
Listeners
The listeners property contains the activator event handlers for each Sensor that is defined on the parent DndContext provider.

It should be attached to the node(s) that you wish to use as the activator to begin a sort event. In most cases, that will be the same node as the one passed to setNodeRef, though not necessarily. For instance, when implementing a sortable element with a "drag handle", the ref should be attached to the parent node that should be sortable, but the listeners can be attached to the handle node instead.

For additional details on the listeners property, refer to the useDraggable documentation.

Attributes
The useSortable hook provides a set of sensible default attributes for draggable items. We recommend you attach these to your draggable elements, though nothing will break if you don't.

For additional details on the attributes property, refer to the useDraggable documentation.

Transform
The transform property represents the displacement and change of scale transformation that a sortable item needs to apply to transition to its new position without needing to update the DOM order.

The transform property for the useSortable hook behaves similarly to the transform property of the useDraggable hook for the active sortable item, when there is no DragOverlay being used.

Node ref
In order for the useSortable hook to function properly, it needs the setNodeRef property to be attached to the HTML element you intend on turning into a sortable element:

Copy
function SortableItem(props) {
  const {setNodeRef} = useDraggable({
    id: props.id,
  });
  
  return (
    <li ref={setNodeRef}>
      {/* ... */}
    </li>
  );
}
Keep in mind that the ref should be assigned to the outer container that you want to become draggable, but this doesn't necessarily need to coincide with the container that the listeners are attached to:

Copy
function SortableItem(props) {
  const {arguments, listeners, setNodeRef} = useDraggable({
    id: props.id,
  });
  
  return (
    <li ref={setNodeRef}>
      {/* ... */}
      <button {...listeners} {...arguments}>Drag handle</button>
    </li>
  );
}
Since the useSortable hook is simply an abstraction on top of the useDraggable and useDroppable hooks, in some advanced use cases, you may also use the setDroppableNodeRef and setDraggableNodeRef properties to connect them to different nodes. For example, if you want the draggable element to have a different dimension than the droppable element that will be sortable:

Copy
function SortableItem(props) {
  const {setDraggableNodeRef, setDroppableNodeRef} = useDraggable({
    id: props.id,
  });
  
  return (
    <li ref={setDroppableNodeRef}>
      {/* ... */}
      <button ref={setDraggableNodeRef}>Drag me</button>
    </li>
  );
}
Activator
setActivatorNodeRef

It's possible for the listeners to be attached to a different node than the one that setNodeRef is attached to.

A common example of this is when implementing a drag handle and attaching the listeners to the drag handle:

Copy
function SortableItem(props) {
  const {listeners, setNodeRef} = useSortable({
    id: props.id,
  });
  
  return (
    <li ref={setNodeRef}>
      {/* ... */}
      <button {...listeners}>Drag handle</button>
    </li>
  );
}
When the activator node differs from the draggable node, we recommend setting the activator node ref on the activator node:

Copy
function SortableItem(props) {
  const {listeners, setNodeRef, setActivatorNodeRef} = useSortable({
    id: props.id,
  });
  
  return (
    <li ref={setNodeRef}>
      {/* ... */}
      <button ref={setActivatorNodeRef} {...listeners}>Drag handle</button>
    </li>
  );
}
This helps @dnd-kit more accurately handle automatic focus management and can also be accessed by sensors for enhanced activation constraints.

Focus management is automatically handled by @dnd-kit. When the activator event is a Keyboard event, focus will automatically be restored back to the first focusable node of the activator node.

If no activator node is set via setActivatorNodeRef, focus will automatically be restored on the first focusable node of the draggable node registered via setNodeRef.

Transition
Refer to the transition argument documentation below.

Arguments
Identifier
The id argument is a string or number that should be unique.

Since the useSortable is an abstraction on top of the useDroppable and useDraggable hooks, which both require a unique identifier, the useSortable hook also requires a unique identifier.

The argument passed to the id argument of useSortable should match the id passed in the items array of the parent SortableContext provider.

Disabled
If you'd like to temporarily disable a sortable item from being interactive, set the disabled argument to true.

Transition
The transition argument controls the value of the transition property for you. It conveniently disables transform transitions while not dragging, but ensures that items transition back to their final positions when the drag operation is ended or cancelled.

It also disables transitions for the active sortable element that is being dragged, unless there is a DragOverlay being used.

The default transition is 250 milliseconds, with an easing function set to ease, but you can customize this and pass any valid CSS transition timing function.

Copy
const {
  transition,
} = useSortable({
  transition: {
    duration: 150, // milliseconds
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  },
});
Make sure you pass the transition style property to the same node that has the transform property applied:

Copy
import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

function SortableItem(props) {
  const {
    transform,
    transition,
  } = useSortable({id: props.id});
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <li style={style}>
      {/* ... */}
    </li>
  );
}
If you prefer, you may also use CSS variables to manage the transform and transition properties:

Copy
import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

function SortableItem(props) {
  const {
    transform,
    transition,
  } = useSortable({id: props.id});
  
  const style = {
    '--translate-x': transform ? transform.x : 0,
    '--translate-y': transform ? transform.y : 0,
    '--transition': transition,
  };
  
  return (
    <li style={style}>
      {/* ... */}
    </li>
  );
}
To disable transitions entirely, set the transition argument to null:

Copy
const {
  transition,
} = useSortable({
  transition: null,
});
If you prefer to manage transitions yourself, you may also choose to do so, but this isn't something we recommend.

Sorting strategy
Optionally, you can pass a local sorting strategy that differs from the global sorting strategy passed to the parent SortableContext provider.