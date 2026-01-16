/// <reference types="vite/client" />

// Declaração de tipos para arquivos de vídeo
declare module '*.MOV' {
    const src: string;
    export default src;
}

declare module '*.mov' {
    const src: string;
    export default src;
}

declare module '*.mp4' {
    const src: string;
    export default src;
}

declare module '*.webm' {
    const src: string;
    export default src;
}
