import { useEffect, useState } from "react";

// Caso você exporte os elementos do convite do Illustrator (como PNG ou SVG transparente),
// coloque-os na pasta "frontend/public/assets/" e insira os caminhos deles na lista abaixo.
// Exemplo: const CUSTOM_LEAF_IMAGES = ["/assets/folha-convite-1.png", "/assets/folha-convite-2.png"];
const CUSTOM_LEAF_IMAGES = [
  "/assets/ESTRELA1.svg",
  "/assets/ESTRELA2.svg",
  "/assets/ESTRELA3.svg",
  "/assets/ESTRELA4.svg",
  "/assets/ESTRELA5.svg",
  "/assets/ESTRELA6.svg"
]; 

export default function FloatingElements() {
  const [elements, setElements] = useState([]);

  useEffect(() => {
    const items = [];

    // Gerar 12 folhas flutuantes
    for (let i = 0; i < 12; i++) {
      const customImg = CUSTOM_LEAF_IMAGES.length > 0 
        ? CUSTOM_LEAF_IMAGES[Math.floor(Math.random() * CUSTOM_LEAF_IMAGES.length)] 
        : null;

      items.push({
        id: `leaf-${i}`,
        type: "leaf",
        image: customImg,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * -20, // delay negativo para as animações começarem imediatamente em andamento
        duration: 20 + Math.random() * 20,
        scale: 0.4 + Math.random() * 0.7,
        rotate: Math.random() * 360,
      });
    }

    // Gerar 25 fagulhas de poeira dourada
    for (let i = 0; i < 25; i++) {
      items.push({
        id: `dust-${i}`,
        type: "dust",
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * -15,
        duration: 10 + Math.random() * 12,
        scale: 0.3 + Math.random() * 0.8,
      });
    }

    setElements(items);
  }, []);

  return (
    <div className="floating-container">
      {elements.map((el) => {
        if (el.type === "leaf") {
          if (el.image) {
            return (
              <img
                key={el.id}
                src={el.image}
                alt=""
                className="floating-leaf"
                style={{
                  left: `${el.left}%`,
                  top: `${el.top}%`,
                  animationDelay: `${el.delay}s`,
                  animationDuration: `${el.duration}s`,
                  transform: `scale(${el.scale}) rotate(${el.rotate}deg)`,
                }}
              />
            );
          }
          return (
            <svg
              key={el.id}
              className="floating-leaf"
              style={{
                left: `${el.left}%`,
                top: `${el.top}%`,
                animationDelay: `${el.delay}s`,
                animationDuration: `${el.duration}s`,
                transform: `scale(${el.scale}) rotate(${el.rotate}deg)`,
              }}
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Traçado de folha orgânica */}
              <path
                d="M50,15 C65,30 68,55 50,85 C32,55 35,30 50,15 Z"
                fill="var(--sage)"
                fillOpacity="0.22"
                stroke="var(--sage-deep)"
                strokeOpacity="0.28"
                strokeWidth="1.5"
              />
              {/* Linha central da folha */}
              <path
                d="M50,15 C50,35 50,65 50,85"
                stroke="var(--sage-deep)"
                strokeOpacity="0.22"
                strokeWidth="1"
              />
            </svg>
          );
        } else {
          return (
            <div
              key={el.id}
              className="floating-dust"
              style={{
                left: `${el.left}%`,
                top: `${el.top}%`,
                animationDelay: `${el.delay}s`,
                animationDuration: `${el.duration}s`,
                transform: `scale(${el.scale})`,
              }}
            />
          );
        }
      })}
    </div>
  );
}
