Below are short
**TypeScript**
 usage examples that illustrate how each ShadCN component can be integrated into a React project. The snippets assume you have properly installed the components in your codebase and imported them from their respective
`ui`
 file
---

## 1

**AlertDialog**

```tsx
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
export function AlertDialogExample() {
  const [open, setOpen] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger>
        <button>Delete Account</button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            account and remove your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => console.log("Account deleted!")}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

## 2

**Tabs**

```tsx
import { useState } from "react"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
export function TabsExample() {
  const [tabValue, setTabValue] = useState("account")
  return (
    <Tabs value={tabValue} onValueChange={setTabValue}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <p>Account tab content...</p>
      </TabsContent>
      <TabsContent value="settings">
        <p>Settings tab content...</p>
      </TabsContent>
    </Tabs>
  )
}
```

---

## 3

**Card**

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
export function CardExample() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
        <CardDescription>Details about your account</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This is the main content area of the card.</p>
      </CardContent>
      <CardFooter>
        <button>Update Profile</button>
      </CardFooter>
    </Card>
  )
}
```

---

## 4

**Slider**

```tsx
import { useState } from "react"
import { Slider } from "@/components/ui/slider"
export function SliderExample() {
  const [value, setValue] = useState<number[]>([50])
  return (
    <div>
      <Slider
        value={value}
        onValueChange={setValue}
        max={100}
        step={1}
      />
      <p>Current: {value[0]}%</p>
    </div>
  )
}
```

---

## 5

**Popover**

```tsx
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
export function PopoverExample() {
  return (
    <Popover>
      <PopoverTrigger>
        <button>Open Popover</button>
      </PopoverTrigger>
      <PopoverContent>
        <p>This is a popover content.</p>
      </PopoverContent>
    </Popover>
  )
}
```

---

## 6

**Progress**

```tsx
import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
export function ProgressExample() {
  const [progressValue, setProgressValue] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setProgressValue((v) => (v < 100 ? v + 10 : v))
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div>
      <Progress value={progressValue} variant="danger" />
      <p>{progressValue}%</p>
    </div>
  )
}
```

---

## 7

**Sheet (Drawer)**

```tsx
import { useState } from "react"
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
export function SheetExample() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        <button>Open Sheet</button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Latest updates and alerts</SheetDescription>
        </SheetHeader>
        <div className="p-4">Sheet Content Goes Here</div>
        <SheetFooter>
          <SheetClose>
            <button>Close</button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

---

## 8

**ScrollArea**

```tsx
import { ScrollArea } from "@/components/ui/scroll-area"
export function ScrollAreaExample() {
  return (
    <ScrollArea style={{ height: 200 }}>
      <div style={{ padding: 16 }}>
        <p>Lots of scrollable content...</p>
        {/* Add enough content to scroll */}
      </div>
    </ScrollArea>
  )
}
```

---

## 9

**Label**

```tsx
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
export function LabelExample() {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="name@example.com" />
    </div>
  )
}
```

---

## 10

**Toaster (Sonner)**

```tsx
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
export function ToasterExample() {
  return (
    <div>
      <button onClick={() => toast.success("Hello from Sonner!")}>
        Show Toast
      </button>
      <Toaster position="top-right" />
    </div>
  )
}
```

---

## 11

**Drawer (vaul)**

```tsx
import {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
export function DrawerExample() {
  return (
    <Drawer>
      <DrawerTrigger>
        <button>Open Drawer</button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Drawer Title</DrawerTitle>
          <DrawerDescription>Description text.</DrawerDescription>
        </DrawerHeader>
        <div className="p-4">Drawer content here...</div>
        <DrawerFooter>
          <DrawerClose>
            <button>Close</button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
```

---

## 12

**Tooltip**

```tsx
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
export function TooltipExample() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <button>Hover or focus me</button>
        </TooltipTrigger>
        <TooltipContent>This is a tooltip</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

---

## 13

**Alert**

```tsx
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
export function AlertExample() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Warning</AlertTitle>
      <AlertDescription>
        Your trial period is about to expire. Please upgrade.
      </AlertDescription>
    </Alert>
  )
}
```

---

## 14

**Switch**

```tsx
import { useState } from "react"
import { Switch } from "@/components/ui/switch"
export function SwitchExample() {
  const [checked, setChecked] = useState(false)
  return (
    <div>
      <Switch
        checked={checked}
        onCheckedChange={(value) => setChecked(!!value)}
      />
      <p>Switch is {checked ? "ON" : "OFF"}</p>
    </div>
  )
}
```

---

## 15

**Breadcrumb**

```tsx
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
export function BreadcrumbExample() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
          <BreadcrumbSeparator />
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink href="/products">Products</BreadcrumbLink>
          <BreadcrumbSeparator />
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbPage>Current Product</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

---

## 16

**Command (cmdk)**

```tsx
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command"
import { useState } from "react"
export function CommandExample() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open Command</button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandItem>Profile</CommandItem>
            <CommandItem>Settings</CommandItem>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
```

---

## 17

**Avatar**

```tsx
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar"
export function AvatarExample() {
  return (
    <Avatar>
      <AvatarImage src="/path/to/image.jpg" alt="User profile" />
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>
  )
}
```

---

## 18

**Menubar**

```tsx
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
} from "@/components/ui/menubar"
export function MenubarExample() {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>New</MenubarItem>
          <MenubarItem>Open...</MenubarItem>
          <MenubarSeparator />
          <MenubarLabel>Recent</MenubarLabel>
          <MenubarItem>File1.txt</MenubarItem>
          <MenubarItem>File2.txt</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}
```

---

## 19

**Icons**

```tsx
import { Icons } from "@/components/ui/icons"
export function IconsExample() {
  return (
    <div>
      <Icons.spinner className="mr-2 h-5 w-5 animate-spin" />
      <Icons.gitHub className="h-5 w-5" />
    </div>
  )
}
```

---

## 20

**Dialog**

```tsx
import { useState } from "react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
export function DialogExample() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Show Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            Some descriptive text for this dialog.
          </DialogDescription>
        </DialogHeader>
        <div>Dialog body content here...</div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button onClick={() => console.log("Confirmed!")}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 21

**Badge**

```tsx
import { Badge } from "@/components/ui/badge"
export function BadgeExample() {
  return (
    <div className="space-x-2">
      <Badge variant="default">Default Badge</Badge>
      <Badge variant="warning">Warning Badge</Badge>
      <Badge variant="destructive">Destructive Badge</Badge>
    </div>
  )
}
```

---

## 22

**Table**

```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
export function TableExample() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Alice</TableCell>
          <TableCell>alice@example.com</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Bob</TableCell>
          <TableCell>bob@example.com</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
```

---

## 23

**Separator**

```tsx
import { Separator } from "@/components/ui/separator"
export function SeparatorExample() {
  return (
    <div>
      <p>Above</p>
      <Separator className="my-2" />
      <p>Below</p>
    </div>
  )
}
```

---

## 24

**Button**

```tsx
import { Button } from "@/components/ui/button"
export function ButtonExample() {
  return (
    <div className="space-x-2">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  )
}
```

---

## 25

**Checkbox**

```tsx
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
export function CheckboxExample() {
  const [checked, setChecked] = useState<"indeterminate" | boolean>(false)
  return (
    <div>
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => setChecked(value)}
      />
      <button onClick={() => setChecked("indeterminate")}>
        Set Indeterminate
      </button>
    </div>
  )
}
```

---

## 26

**Collapsible**

```tsx
import { useState } from "react"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
export function CollapsibleExample() {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button>Toggle</button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p>This content is {open ? "visible" : "hidden"}</p>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

---

## 27

**DropdownMenu**

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
export function DropdownMenuExample() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button>Actions</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => console.log("Copy")}>
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => console.log("Paste")}>
          Paste
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => console.log("Delete")}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## 28

**Select**

```tsx
import { useState } from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
export function SelectExample() {
  const [selected, setSelected] = useState("apple")
  return (
    <Select value={selected} onValueChange={setSelected}>
      <SelectTrigger>
        <SelectValue placeholder="Choose a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="orange">Orange</SelectItem>
      </SelectContent>
    </Select>
  )
}
```

---

## 29

**Textarea**

```tsx
import { Textarea } from "@/components/ui/textarea"
export function TextareaExample() {
  return (
    <Textarea placeholder="Enter some text..." />
  )
}
```

---

## 30

**Input**

```tsx
import { Input } from "@/components/ui/input"
export function InputExample() {
  return (
    <Input type="text" placeholder="Type something here..." />
  )
}
```

---

## 31

**Skeleton**

```tsx
import { Skeleton } from "@/components/ui/skeleton"
export function SkeletonExample() {
  return (
    <div className="w-48">
      <Skeleton className="h-4 mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}
```

---

## 32

**Form**
 (react-hook-form integration)

```tsx
import { useForm } from "react-hook-form"
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
type FormValues = {
  email: string
}
export function FormExample() {
  const form = useForm<FormValues>({
    defaultValues: {
      email: "",
    },
  })
  function onSubmit(data: FormValues) {
    console.log("Form submitted:", data)
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

---

## 33

**ContextMenu**

```tsx
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
export function ContextMenuExample() {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="w-48 h-24 border flex items-center justify-center">
          Right-click me
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => console.log("Cut")}>Cut</ContextMenuItem>
        <ContextMenuItem onSelect={() => console.log("Copy")}>Copy</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => console.log("Paste")}>Paste</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

---

## Notes

-

All these components rely on
**Radix UI primitives**
 or third-party libraries, wrapped with additional styling and structure
-

Most accept standard props (e.g.
`className`
,
`...props`
) plus any extra ones from the underlying libraries
-

Components with
`onOpenChange`
,
`open`
, or
`checked`
 typically handle
**controlled vs. uncontrolled**
 states.  
-

 Usage patterns often follow “root + trigger + content + items” for dropdowns, dialogs, popovers, etc.
