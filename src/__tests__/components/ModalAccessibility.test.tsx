import {render,screen,fireEvent} from "@testing-library/react";
import {useState} from "react";
import Modal from "@/components/ui/Modal";
function Harness(){const[open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Open editor</button><Modal isOpen={open} title="Edit record" onClose={()=>setOpen(false)}><input aria-label="Draft"/><button>Save</button></Modal></>;}
test("dialog has a name, traps focus, makes background inert, and restores focus on Escape",()=>{
 const {container}=render(<Harness/>);const opener=screen.getByRole("button",{name:"Open editor"});opener.focus();fireEvent.click(opener);
 const dialog=screen.getByRole("dialog",{name:"Edit record"});expect(dialog).toHaveAttribute("aria-modal","true");
 expect(container).toHaveAttribute("inert");const close=screen.getByRole("button",{name:"Close dialog"});expect(close).toHaveFocus();
 fireEvent.keyDown(close,{key:"Tab",shiftKey:true});expect(screen.getByRole("button",{name:"Save"})).toHaveFocus();
 fireEvent.keyDown(document.activeElement!,{key:"Tab"});expect(close).toHaveFocus();
 fireEvent.keyDown(close,{key:"Escape"});expect(screen.queryByRole("dialog")).not.toBeInTheDocument();expect(opener).toHaveFocus();expect(container).not.toHaveAttribute("inert");
});

function Nested(){const[parent,setParent]=useState(true);const[child,setChild]=useState(false);return <Modal isOpen={parent} title="Parent" onClose={()=>setParent(false)}><button onClick={()=>setChild(true)}>Open nested</button><Modal isOpen={child} title="Nested" onClose={()=>setChild(false)}><button>Child action</button></Modal></Modal>;}
test("nested dialogs keep the parent inert and only close the top dialog",()=>{
 const {container}=render(<Nested/>);const trigger=screen.getByRole("button",{name:"Open nested"});trigger.focus();fireEvent.click(trigger);
 const parent=screen.getByRole("dialog",{name:"Parent"});expect(parent.parentElement).toHaveAttribute("inert");
 fireEvent.keyDown(document.activeElement!,{key:"Escape"});expect(screen.queryByRole("dialog",{name:"Nested"})).not.toBeInTheDocument();
 expect(screen.getByRole("dialog",{name:"Parent"})).toBeInTheDocument();expect(trigger).toHaveFocus();expect(container).toHaveAttribute("inert");
 fireEvent.keyDown(trigger,{key:"Escape"});expect(container).not.toHaveAttribute("inert");
});
