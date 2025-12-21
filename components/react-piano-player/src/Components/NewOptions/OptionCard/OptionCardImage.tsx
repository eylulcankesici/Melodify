import React, { ReactElement,useRef, useState } from 'react'

import {checkExtension} from '../../../Utils/smallFunctions';

interface CardProps{
    onChange: Function;
    name: string;
    type: string;
    title?:string;
    children:React.ReactNode;
    value: string|boolean,
    textColor:string
}

export default function OptionCard({onChange,name,type,textColor,title,children,value}:CardProps):ReactElement {

    const Myvalue = useRef<HTMLInputElement | null>(null);
    const [image,setImage] = useState<any>();

    const handleChange = () =>{
        const file = Myvalue.current?.files?.[0];
        
        if(!file){
            return;
        }
        
        function convertDataToArray64(selectedFile: File):Promise<ArrayBuffer | string> {
            return new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
        
                reader.onload = (event:any) => {
                    resolve(event.target.result);
                };
        
                reader.onerror = (err) => {
                    reject(err);
                };
                // reader.readAsArrayBuffer(selectedFile);
                reader.readAsDataURL(selectedFile)
            });
        }
        
        if(checkExtension(file,'.jpg') || checkExtension(file,'.png') || checkExtension(file,'.gif')){
            convertDataToArray64(file).then(reading =>{
                const data = {
                    target:{name:'Image', value:reading}
                };
                onChange(data);
                setImage(reading);
            })
        }
        else{
            alert('Error, Image Format Not supported');
        }
    }
    return (
        <div className={`${name}Div OptionCard`}>
                <h1 className={`Card_Title ${textColor ? textColor : ''}`} >{title}</h1>
                <h2 className='Card_Description'>{children}</h2>
                {!image && 
                    <div className='inputImageDiv'>
                    <h1>Insert Image</h1>
                    <input className={`ImageInput`} accept='.jpg,.png,.gif' ref={Myvalue} type='file' name={name} onChange={handleChange} />
                    </div>
                }
                {image && <img src={image} alt='your' className='inputImage' />}
        </div>
    )
}